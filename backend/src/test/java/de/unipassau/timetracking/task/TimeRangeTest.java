package de.unipassau.timetracking.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.unipassau.timetracking.user.AppUser;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class TimeRangeTest {

  private final AppUser owner = new AppUser("user@example.com", "hash");

  private Task taskStartingAt(String instant) {
    return new Task(owner, "task", Instant.parse(instant));
  }

  @Test
  void parseReturnsNullForBlankOrMissingValues() {
    assertThat(TimeRange.parse(null)).isNull();
    assertThat(TimeRange.parse("")).isNull();
    assertThat(TimeRange.parse("   ")).isNull();
  }

  @Test
  void parseRejectsAnInvalidFormat() {
    assertThatThrownBy(() -> TimeRange.parse("not-a-date"))
        .isInstanceOf(InvalidTimeRangeException.class);
  }

  @Test
  void parseAcceptsAnIsoInstant() {
    assertThat(TimeRange.parse("2024-01-01T10:00:00Z"))
        .isEqualTo(Instant.parse("2024-01-01T10:00:00Z"));
  }

  @Test
  void validateRejectsToNotAfterFrom() {
    Instant from = Instant.parse("2024-01-02T00:00:00Z");
    Instant to = Instant.parse("2024-01-01T00:00:00Z");
    assertThatThrownBy(() -> TimeRange.validate(from, to))
        .isInstanceOf(InvalidTimeRangeException.class);
    assertThatThrownBy(() -> TimeRange.validate(from, from))
        .isInstanceOf(InvalidTimeRangeException.class);
  }

  @Test
  void validateAllowsOpenEndedOrEmptyRanges() {
    TimeRange.validate(null, null);
    TimeRange.validate(Instant.now(), null);
    TimeRange.validate(null, Instant.now());
  }

  @Test
  void containsIsStartInclusiveAndEndExclusive() {
    Instant from = Instant.parse("2024-01-01T00:00:00Z");
    Instant to = Instant.parse("2024-01-02T00:00:00Z");

    assertThat(TimeRange.contains(taskStartingAt("2024-01-01T00:00:00Z"), from, to)).isTrue();
    assertThat(TimeRange.contains(taskStartingAt("2024-01-01T23:59:59Z"), from, to)).isTrue();
    assertThat(TimeRange.contains(taskStartingAt("2024-01-02T00:00:00Z"), from, to)).isFalse();
    assertThat(TimeRange.contains(taskStartingAt("2023-12-31T23:59:59Z"), from, to)).isFalse();
  }

  @Test
  void containsWithAnOpenStartOnlyChecksTheEnd() {
    Instant to = Instant.parse("2024-01-02T00:00:00Z");
    assertThat(TimeRange.contains(taskStartingAt("2020-01-01T00:00:00Z"), null, to)).isTrue();
    assertThat(TimeRange.contains(taskStartingAt("2024-01-02T00:00:00Z"), null, to)).isFalse();
  }

  @Test
  void containsWithAnOpenEndOnlyChecksTheStart() {
    Instant from = Instant.parse("2024-01-01T00:00:00Z");
    assertThat(TimeRange.contains(taskStartingAt("2030-01-01T00:00:00Z"), from, null)).isTrue();
    assertThat(TimeRange.contains(taskStartingAt("2023-12-31T00:00:00Z"), from, null)).isFalse();
  }

  @Test
  void containsWithNoBoundsAlwaysMatches() {
    assertThat(TimeRange.contains(taskStartingAt("2024-01-01T00:00:00Z"), null, null)).isTrue();
  }
}
