package com.paolociotta.assistant.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Live content sources for the site: the CV PDF and the GitHub account.
 *
 * @param cvPath      path of the CV PDF inside the container (blank = no CV)
 * @param githubUser  whose public repositories appear in the Lab
 * @param githubToken optional token, only to raise GitHub's rate limit (60 req/h without)
 */
@ConfigurationProperties(prefix = "site")
public record SiteProperties(String cvPath, String githubUser, String githubToken) {
}
