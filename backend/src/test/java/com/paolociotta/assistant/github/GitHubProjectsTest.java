package com.paolociotta.assistant.github;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GitHubProjectsTest {

    @Test
    void takesTheFirstRealParagraphOfAReadme() {
        String md = """
                # Fridge Manager
                [![build](https://img.shields.io/badge.svg)](https://ci)

                Web app to manage the **fridge**: expiry dates and recipes, with [AI](https://claude.com) photo recognition.
                Runs with `docker compose`.

                ## Setup
                Something else.
                """;
        assertThat(GitHubProjects.summarize(md))
                .isEqualTo("Web app to manage the fridge: expiry dates and recipes, with AI photo recognition. Runs with docker compose.");
    }

    @Test
    void ignoresCodeBlocksAndHandlesEmptyReadmes() {
        assertThat(GitHubProjects.summarize("```\ncode only\n```\n# Title")).isNull();
        assertThat(GitHubProjects.summarize(null)).isNull();
    }

    @Test
    void truncatesLongParagraphsOnAWordBoundary() {
        String s = GitHubProjects.summarize("word ".repeat(100));
        assertThat(s).endsWith("…").hasSizeLessThanOrEqualTo(241);
    }
}
