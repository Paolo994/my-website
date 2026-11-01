package com.paolociotta.assistant.ask;

import com.paolociotta.assistant.ratelimit.RateLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** ASSISTANT_ENABLED=false switches the AI off even when a key is configured. */
@WebMvcTest(AskController.class)
@TestPropertySource(properties = {"assistant.active=false", "assistant.api-key=test-key-not-real"})
class AskControllerSwitchedOffTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    AssistantService assistant;

    @MockitoBean
    RateLimiter rateLimiter;

    @Test
    void masterSwitchOffWinsOverAConfiguredKey() throws Exception {
        mvc.perform(get("/api/assistant")).andExpect(jsonPath("$.enabled").value(false));
        mvc.perform(post("/api/ask").contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"Hi\"}"))
                .andExpect(status().isServiceUnavailable());
        verify(assistant, never()).ask(any());
    }
}
