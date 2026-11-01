package com.paolociotta.assistant.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.List;

/**
 * Everything that can be tuned without touching code. See application.yml for defaults.
 */
@Validated
@ConfigurationProperties(prefix = "assistant")
public record AssistantProperties(
        boolean active, // ASSISTANT_ENABLED: master switch for the AI assistant
        String apiKey,  // blank: the app starts with the assistant switched off
        @NotBlank String model,
        @NotBlank String effort,
        @Min(256) long maxTokens,
        @Min(20) int maxQuestionLength,
        @Min(0) int maxHistoryTurns,
        @NotBlank String contactEmail,
        RateLimit rateLimit,
        List<String> allowedOrigins,
        boolean logQuestions
) {

    public boolean enabled() {
        return active && apiKey != null && !apiKey.isBlank() && !"disabled".equals(apiKey);
    }

    /**
     * Abuse and cost protection: per visitor (IP) per minute and per day, plus a global daily cap.
     */
    public record RateLimit(@Min(1) int perMinute, @Min(1) int perDay, @Min(1) int globalPerDay) {
    }
}
