package com.paolociotta.assistant.knowledge;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * The only source of truth the assistant may use: a curated Markdown profile shipped with the app.
 * It is small (a few thousand tokens), so it goes straight into the cached system prompt:
 * no vector store or retrieval step is needed at this size.
 */
@Component
public class KnowledgeBase {

    /** Section ids of the website, so the assistant can point the visitor to the right building. */
    public static final List<String> SECTIONS =
            List.of("none", "about", "experience", "cases", "ailab", "skills", "garage", "contact",
                    "cases/kafka", "cases/cache", "cases/datastore", "cases/java", "cases/observability");

    private final String profile;

    public KnowledgeBase() {
        this(new ClassPathResource("knowledge/profile.md"));
    }

    KnowledgeBase(ClassPathResource resource) {
        try {
            this.profile = resource.getContentAsString(StandardCharsets.UTF_8).strip();
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot load the profile knowledge base", e);
        }
        if (profile.isEmpty()) {
            throw new IllegalStateException("The profile knowledge base is empty");
        }
    }

    public String profile() {
        return profile;
    }
}
