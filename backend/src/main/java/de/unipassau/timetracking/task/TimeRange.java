package de.unipassau.timetracking.task;

import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * Parses and applies the optional {@code from}/{@code to} query parameters used to scope task lists
 * and project totals to a user-selected time window. The window is start-inclusive, end-exclusive,
 * matching how a calendar day/week/month boundary is computed on the frontend.
 */
public final class TimeRange {

  private TimeRange() {}

  public static Instant parse(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return Instant.parse(value);
    } catch (DateTimeParseException e) {
      throw new InvalidTimeRangeException("Invalid date-time: " + value);
    }
  }

  public static void validate(Instant from, Instant to) {
    if (from != null && to != null && !to.isAfter(from)) {
      throw new InvalidTimeRangeException();
    }
  }

  public static boolean contains(Task task, Instant from, Instant to) {
    Instant startTime = task.getStartTime();
    if (from != null && startTime.isBefore(from)) {
      return false;
    }
    return to == null || startTime.isBefore(to);
  }
}
