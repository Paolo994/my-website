package com.paolociotta.assistant.ask;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * A visitor question plus the last few turns of the conversation (kept client-side; the server is stateless).
 * Sizes are capped here so a single request can't blow up the prompt.
 */
public record AskRequest(
        @NotBlank @Size(max = 500) String question,
        @Size(max = 12) List<@Valid Turn> history
) {

    public record Turn(
            @NotBlank @Pattern(regexp = "user|assistant") String role,
            @NotBlank @Size(max = 2000) String text
    ) {
        boolean isUser() {
            return "user".equals(role);
        }
    }
}
