package com.paolociotta.assistant.ask;

import com.paolociotta.assistant.knowledge.KnowledgeBase;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SystemPromptTest {

    private final KnowledgeBase kb = new KnowledgeBase();

    @Test
    void isDeterministicSoThePromptCacheKeepsHitting() {
        assertThat(SystemPrompt.build(kb.profile(), "a@b.c")).isEqualTo(SystemPrompt.build(kb.profile(), "a@b.c"));
    }

    @Test
    void containsTheProfileAndTheContactEmail() {
        String prompt = SystemPrompt.build(kb.profile(), "paolociotta1@gmail.com");
        assertThat(prompt)
                .contains("<profile>")
                .contains("Hazelcast")
                .contains("paolociotta1@gmail.com");
    }

    @Test
    void mentionsEverySectionTheFrontendKnows() {
        String prompt = SystemPrompt.build(kb.profile(), "x");
        KnowledgeBase.SECTIONS.stream().filter(s -> !"none".equals(s))
                .forEach(s -> assertThat(prompt).contains(" " + s + " ("));
    }

    @Test
    void profileContainsNoPhoneNumbers() {
        // international prefixes (+39 ...) or 9+ consecutive digits look like phone numbers;
        // year ranges such as "2013 - 2018" are fine
        assertThat(kb.profile())
                .doesNotContainPattern("\\+\\d{2}[\\s\\d]{6,}")
                .doesNotContainPattern("\\d{9,}");
    }
}
