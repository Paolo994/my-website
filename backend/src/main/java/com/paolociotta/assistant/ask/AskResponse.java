package com.paolociotta.assistant.ask;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * @param answer  text to show the visitor
 * @param section id of the website section worth opening next, or null
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AskResponse(String answer, String section) {
}
