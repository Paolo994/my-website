package com.paolociotta.assistant.ask;

import com.anthropic.client.AnthropicClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.models.messages.CacheControlEphemeral;
import com.anthropic.models.messages.JsonOutputFormat;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlockParam;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.paolociotta.assistant.config.AssistantProperties;
import com.paolociotta.assistant.github.GitHubProjects;
import com.paolociotta.assistant.knowledge.CvSource;
import com.paolociotta.assistant.knowledge.KnowledgeBase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Answers visitor questions about Paolo with a single, grounded Claude call.
 *
 * Design choices:
 * - The whole profile fits in the prompt, so there is no retrieval step: one call, low latency.
 * - The system prompt (rules + profile + latest CV) only changes when the CV PDF is replaced, and is
 *   marked for prompt caching, so repeated questions only pay full price for the short, variable part.
 * - The live GitHub repository list goes in a second, uncached system block after the cache breakpoint,
 *   so a new repo never invalidates the cached prompt.
 * - Structured output returns {answer, section}: the text to show plus which part of the site
 *   the visitor should open next, constrained to the real section ids.
 */
@Service
public class AssistantService {

    private static final Logger log = LoggerFactory.getLogger(AssistantService.class);

    private final AnthropicClient client;
    private final AssistantProperties props;
    private final ObjectMapper mapper;
    private final KnowledgeBase kb;
    private final CvSource cv;
    private final GitHubProjects github;
    private final OutputConfig outputConfig;

    /** Cached system block, rebuilt only when the CV text changes. */
    private record CachedPrompt(String cvText, TextBlockParam block) {
    }

    private volatile CachedPrompt cachedPrompt;

    public AssistantService(AnthropicClient client, AssistantProperties props, KnowledgeBase kb, CvSource cv,
                            GitHubProjects github, ObjectMapper mapper) {
        this.client = client;
        this.props = props;
        this.mapper = mapper;
        this.kb = kb;
        this.cv = cv;
        this.github = github;
        this.outputConfig = OutputConfig.builder()
                .effort(OutputConfig.Effort.of(props.effort()))
                .format(JsonOutputFormat.builder().schema(replySchema()).build())
                .build();
    }

    public AskResponse ask(AskRequest request) {
        MessageCreateParams.Builder params = MessageCreateParams.builder()
                .model(props.model())
                .maxTokens(props.maxTokens())
                .systemOfTextBlockParams(systemBlocks())
                .outputConfig(outputConfig)
                // if a safety classifier ever declines, let the API retry on a fallback model
                .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"));

        List<AskRequest.Turn> history = request.history() == null ? List.of() : request.history();
        int from = Math.max(0, history.size() - props.maxHistoryTurns());
        while (from < history.size() && !history.get(from).isUser()) {
            from++; // the conversation sent to the model must start with a visitor turn
        }
        for (AskRequest.Turn turn : history.subList(from, history.size())) {
            if (turn.isUser()) {
                params.addUserMessage(turn.text());
            } else {
                params.addAssistantMessage(turn.text());
            }
        }
        params.addUserMessage(request.question().strip());

        long started = System.nanoTime();
        Message response;
        try {
            response = client.messages().create(params.build());
        } catch (RateLimitException e) {
            throw new AssistantUnavailableException("Upstream rate limit", e);
        } catch (AnthropicServiceException e) {
            log.warn("Claude API error: status={} type={}", e.statusCode(), e.errorType().orElse(null));
            throw new AssistantUnavailableException("Upstream API error", e);
        }
        long ms = (System.nanoTime() - started) / 1_000_000;
        log.info("answered in {} ms, input={} cacheRead={} output={}{}", ms,
                response.usage().inputTokens(),
                response.usage().cacheReadInputTokens().orElse(0L),
                response.usage().outputTokens(),
                props.logQuestions() ? ", question=\"" + request.question().strip() + "\"" : "");

        return toResponse(response);
    }

    List<TextBlockParam> systemBlocks() {
        String cvText = cv.text();
        CachedPrompt current = cachedPrompt;
        if (current == null || !current.cvText().equals(cvText)) {
            current = new CachedPrompt(cvText, TextBlockParam.builder()
                    .text(SystemPrompt.build(kb.profile(), cvText, props.contactEmail()))
                    .cacheControl(CacheControlEphemeral.builder().ttl(CacheControlEphemeral.Ttl.TTL_1H).build())
                    .build());
            cachedPrompt = current;
        }
        List<GitHubProjects.Project> repos = github.list();
        if (repos.isEmpty()) {
            return List.of(current.block());
        }
        String list = repos.stream()
                .map(p -> "- " + p.name() + ": " + (p.description() == null ? "(no description)" : p.description())
                        + (p.language() == null ? "" : " [" + p.language() + "]")
                        + " updated " + p.pushedAt().substring(0, Math.min(10, p.pushedAt().length()))
                        + " " + p.url())
                .collect(Collectors.joining("\n"));
        return List.of(current.block(), TextBlockParam.builder().text(SystemPrompt.liveContext(list.strip())).build());
    }

    AskResponse toResponse(Message response) {
        StopReason stop = response.stopReason().orElse(null);
        if (StopReason.REFUSAL.equals(stop)) {
            return new AskResponse(fallbackText(), "contact");
        }
        String json = response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(t -> t.text())
                .reduce("", String::concat)
                .strip();
        try {
            Reply reply = mapper.readValue(json, Reply.class);
            String section = KnowledgeBase.SECTIONS.contains(reply.section()) && !"none".equals(reply.section())
                    ? reply.section() : null;
            if (reply.answer() == null || reply.answer().isBlank()) {
                return new AskResponse(fallbackText(), "contact");
            }
            return new AskResponse(reply.answer().strip(), section);
        } catch (JsonProcessingException e) {
            log.warn("Could not parse structured reply (stop reason {})", stop);
            return new AskResponse(fallbackText(), "contact");
        }
    }

    private String fallbackText() {
        return "Sorry, I can't answer that right now. You can ask Paolo directly at " + props.contactEmail() + ".";
    }

    private static JsonOutputFormat.Schema replySchema() {
        return JsonOutputFormat.Schema.builder()
                .putAdditionalProperty("type", JsonValue.from("object"))
                .putAdditionalProperty("properties", JsonValue.from(Map.of(
                        "answer", Map.of(
                                "type", "string",
                                "description", "The reply shown to the visitor. Plain text; '- ' bullets and **bold** allowed."),
                        "section", Map.of(
                                "type", "string",
                                "enum", KnowledgeBase.SECTIONS,
                                "description", "The website section most worth opening next, or none."))))
                .putAdditionalProperty("required", JsonValue.from(List.of("answer", "section")))
                .putAdditionalProperty("additionalProperties", JsonValue.from(false))
                .build();
    }

    /** Shape of the structured output. */
    record Reply(String answer, String section) {
    }
}
