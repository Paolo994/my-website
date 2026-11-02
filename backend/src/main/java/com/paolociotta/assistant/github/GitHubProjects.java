package com.paolociotta.assistant.github;

import com.fasterxml.jackson.databind.JsonNode;
import com.paolociotta.assistant.config.SiteProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Paolo's public GitHub repositories, refreshed in the background (at startup, then every GITHUB_REFRESH).
 * Plain Java: GitHub REST API + README parsing, no AI involved.
 * Used by the Lab section of the site and by the assistant, so a new repo shows up without touching the site.
 */
@Service
public class GitHubProjects {

    private static final Logger log = LoggerFactory.getLogger(GitHubProjects.class);
    private static final int MAX_SUMMARY = 240;

    public record Project(String name, String description, String language, List<String> topics,
                          String url, String homepage, String pushedAt, int stars) {
    }

    private final RestClient http;
    private final SiteProperties site;
    private volatile List<Project> projects = List.of();

    public GitHubProjects(SiteProperties site) {
        this.site = site;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(10));
        RestClient.Builder builder = RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("User-Agent", "paolociotta-site")
                .defaultHeader("Accept", "application/vnd.github+json");
        if (site.githubToken() != null && !site.githubToken().isBlank()) {
            builder.defaultHeader("Authorization", "Bearer " + site.githubToken());
        }
        this.http = builder.build();
    }

    public List<Project> list() {
        return projects;
    }

    /** Runs at startup, then every site.github-refresh (GITHUB_REFRESH, default 24h). */
    @Scheduled(initialDelay = 0, fixedDelayString = "${site.github-refresh:24h}")
    public void refresh() {
        if (site.githubUser() == null || site.githubUser().isBlank()) {
            return;
        }
        try {
            JsonNode repos = http.get()
                    .uri("https://api.github.com/users/{user}/repos?per_page=100&sort=pushed", site.githubUser())
                    .retrieve()
                    .body(JsonNode.class);
            List<Project> fresh = new ArrayList<>();
            for (JsonNode r : repos) {
                if (r.path("fork").asBoolean() || r.path("archived").asBoolean() || r.path("private").asBoolean()) {
                    continue;
                }
                String name = r.path("name").asText();
                String description = text(r, "description");
                if (description == null) {
                    description = readmeSummary(name);
                }
                List<String> topics = new ArrayList<>();
                r.path("topics").forEach(t -> topics.add(t.asText()));
                fresh.add(new Project(name, description, text(r, "language"), topics,
                        r.path("html_url").asText(), text(r, "homepage"),
                        r.path("pushed_at").asText(), r.path("stargazers_count").asInt()));
            }
            projects = List.copyOf(fresh);
            log.info("GitHub projects refreshed: {}", fresh.stream().map(Project::name).toList());
        } catch (Exception e) {
            // keep the last good list; the site and the assistant keep working
            log.warn("Could not refresh GitHub projects: {}", e.getMessage());
        }
    }

    private String readmeSummary(String repo) {
        try {
            String md = http.get()
                    .uri("https://raw.githubusercontent.com/{user}/{repo}/HEAD/README.md", site.githubUser(), repo)
                    .retrieve()
                    .body(String.class);
            return summarize(md);
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() || v.asText().isBlank() ? null : v.asText().strip();
    }

    private static final Pattern IMAGE = Pattern.compile("!\\[[^]]*]\\([^)]*\\)");
    private static final Pattern LINK = Pattern.compile("\\[([^]]*)]\\([^)]*\\)");
    private static final Pattern HTML = Pattern.compile("<[^>]+>");

    /** First real paragraph of a README: no headings, badges, code, tables or quotes; markdown stripped. */
    static String summarize(String md) {
        if (md == null) {
            return null;
        }
        boolean inCode = false;
        StringBuilder para = new StringBuilder();
        for (String raw : md.replace("\r", "").split("\n")) {
            String line = raw.strip();
            if (line.startsWith("```")) {
                inCode = !inCode;
                continue;
            }
            if (inCode) {
                continue;
            }
            boolean skip = line.startsWith("#") || line.startsWith("|") || line.startsWith(">")
                    || line.startsWith("<") || line.startsWith("!") || line.startsWith("[!") || line.startsWith("---");
            if (line.isEmpty() || skip) {
                if (!para.isEmpty()) {
                    break;
                }
                continue;
            }
            para.append(line).append(' ');
        }
        String text = HTML.matcher(LINK.matcher(IMAGE.matcher(para).replaceAll("")).replaceAll("$1")).replaceAll("")
                .replaceAll("[*_`]", "").replaceAll("\\s+", " ").strip();
        if (text.isEmpty()) {
            return null;
        }
        if (text.length() > MAX_SUMMARY) {
            int cut = text.lastIndexOf(' ', MAX_SUMMARY);
            text = text.substring(0, cut > 0 ? cut : MAX_SUMMARY) + "…";
        }
        return text;
    }
}
