package com.paolociotta.assistant.ask;

import com.paolociotta.assistant.config.AssistantProperties;
import com.paolociotta.assistant.ratelimit.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AskController {

    private final AssistantService assistant;
    private final RateLimiter rateLimiter;
    private final AssistantProperties props;

    public AskController(AssistantService assistant, RateLimiter rateLimiter, AssistantProperties props) {
        this.assistant = assistant;
        this.rateLimiter = rateLimiter;
        this.props = props;
    }

    /** The site calls this on load and only shows the chat button when the assistant is enabled. */
    @GetMapping("/assistant")
    public Map<String, Object> status() {
        return Map.of("enabled", props.enabled(), "maxQuestionLength", props.maxQuestionLength());
    }

    @PostMapping("/ask")
    public ResponseEntity<?> ask(@Valid @RequestBody AskRequest request, HttpServletRequest http) {
        if (!props.enabled()) {
            throw new AssistantUnavailableException("Assistant disabled: no API key configured");
        }
        if (request.question().strip().length() > props.maxQuestionLength()) {
            return ResponseEntity.badRequest().body(Map.of("error", "question_too_long"));
        }
        return switch (rateLimiter.tryAcquire(http.getRemoteAddr())) {
            case ALLOWED -> ResponseEntity.ok(assistant.ask(request));
            case VISITOR_LIMIT -> ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", "rate_limited"));
            case GLOBAL_LIMIT -> ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "daily_limit"));
        };
    }
}
