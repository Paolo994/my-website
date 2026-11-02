package com.paolociotta.assistant.github;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@RestController
public class ProjectsController {

    private final GitHubProjects projects;

    public ProjectsController(GitHubProjects projects) {
        this.projects = projects;
    }

    /** Public GitHub repositories for the Lab section (cached server-side, refreshed hourly). */
    @GetMapping("/api/projects")
    public ResponseEntity<List<GitHubProjects.Project>> list() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic())
                .body(projects.list());
    }
}
