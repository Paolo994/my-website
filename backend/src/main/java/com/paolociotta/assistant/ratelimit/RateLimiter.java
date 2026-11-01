package com.paolociotta.assistant.ratelimit;

import com.paolociotta.assistant.config.AssistantProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Small in-memory fixed-window limiter: per visitor per minute, per visitor per day, and a global daily cap
 * that bounds the worst-case API bill. One instance is enough for a personal site; with several replicas
 * this would move to Redis or a shared cache.
 */
@Component
public class RateLimiter {

    public enum Verdict { ALLOWED, VISITOR_LIMIT, GLOBAL_LIMIT }

    private final AssistantProperties.RateLimit limits;
    private final Clock clock;

    private final Map<String, Window> perMinute = new ConcurrentHashMap<>();
    private final Map<String, Window> perDay = new ConcurrentHashMap<>();
    private volatile Window global;

    public RateLimiter(AssistantProperties props, Clock clock) {
        this.limits = props.rateLimit();
        this.clock = clock;
        this.global = new Window(today());
    }

    public synchronized Verdict tryAcquire(String visitor) {
        Instant now = clock.instant();
        long minute = now.getEpochSecond() / 60;
        long day = today();

        if (global.key != day) {
            global = new Window(day);
        }
        if (global.count.get() >= limits.globalPerDay()) {
            return Verdict.GLOBAL_LIMIT;
        }
        Window m = perMinute.compute(visitor, (k, w) -> w == null || w.key != minute ? new Window(minute) : w);
        Window d = perDay.compute(visitor, (k, w) -> w == null || w.key != day ? new Window(day) : w);
        if (m.count.get() >= limits.perMinute() || d.count.get() >= limits.perDay()) {
            return Verdict.VISITOR_LIMIT;
        }
        m.count.incrementAndGet();
        d.count.incrementAndGet();
        global.count.incrementAndGet();
        return Verdict.ALLOWED;
    }

    /** Drop expired windows so the maps don't grow forever. */
    @Scheduled(fixedDelay = 10 * 60 * 1000)
    public void evictExpired() {
        long minute = clock.instant().getEpochSecond() / 60;
        long day = today();
        perMinute.values().removeIf(w -> w.key != minute);
        perDay.values().removeIf(w -> w.key != day);
    }

    private long today() {
        return LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC).toEpochDay();
    }

    private static final class Window {
        final long key;
        final AtomicInteger count = new AtomicInteger();

        Window(long key) {
            this.key = key;
        }
    }
}
