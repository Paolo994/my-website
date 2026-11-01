package com.paolociotta.assistant.ratelimit;

import com.paolociotta.assistant.config.AssistantProperties;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static com.paolociotta.assistant.ratelimit.RateLimiter.Verdict.ALLOWED;
import static com.paolociotta.assistant.ratelimit.RateLimiter.Verdict.GLOBAL_LIMIT;
import static com.paolociotta.assistant.ratelimit.RateLimiter.Verdict.VISITOR_LIMIT;
import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-01T10:00:00Z"));

    private RateLimiter limiter(int perMinute, int perDay, int global) {
        var props = new AssistantProperties(true, "key", "model", "low", 1000, 500, 6, "a@b.c",
                new AssistantProperties.RateLimit(perMinute, perDay, global), List.of(), false);
        return new RateLimiter(props, clock);
    }

    @Test
    void blocksAVisitorAfterThePerMinuteLimitAndResetsNextMinute() {
        RateLimiter rl = limiter(2, 100, 1000);
        assertThat(rl.tryAcquire("1.1.1.1")).isEqualTo(ALLOWED);
        assertThat(rl.tryAcquire("1.1.1.1")).isEqualTo(ALLOWED);
        assertThat(rl.tryAcquire("1.1.1.1")).isEqualTo(VISITOR_LIMIT);
        assertThat(rl.tryAcquire("2.2.2.2")).isEqualTo(ALLOWED);

        clock.advance(Duration.ofMinutes(1));
        assertThat(rl.tryAcquire("1.1.1.1")).isEqualTo(ALLOWED);
    }

    @Test
    void enforcesThePerDayLimitAcrossMinutes() {
        RateLimiter rl = limiter(10, 3, 1000);
        for (int i = 0; i < 3; i++) {
            assertThat(rl.tryAcquire("1.1.1.1")).isEqualTo(ALLOWED);
            clock.advance(Duration.ofMinutes(5));
        }
        assertThat(rl.tryAcquire("1.1.1.1")).isEqualTo(VISITOR_LIMIT);

        clock.advance(Duration.ofDays(1));
        assertThat(rl.tryAcquire("1.1.1.1")).isEqualTo(ALLOWED);
    }

    @Test
    void globalDailyCapProtectsTheBill() {
        RateLimiter rl = limiter(10, 10, 2);
        assertThat(rl.tryAcquire("a")).isEqualTo(ALLOWED);
        assertThat(rl.tryAcquire("b")).isEqualTo(ALLOWED);
        assertThat(rl.tryAcquire("c")).isEqualTo(GLOBAL_LIMIT);
    }

    @Test
    void rejectedRequestsDoNotConsumeQuota() {
        RateLimiter rl = limiter(1, 10, 10);
        assertThat(rl.tryAcquire("a")).isEqualTo(ALLOWED);
        assertThat(rl.tryAcquire("a")).isEqualTo(VISITOR_LIMIT);
        assertThat(rl.tryAcquire("a")).isEqualTo(VISITOR_LIMIT);
        assertThat(rl.tryAcquire("b")).isEqualTo(ALLOWED); // global count is 2, not 4
    }

    static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
