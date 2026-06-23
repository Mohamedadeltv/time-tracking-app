package de.unipassau.timetracking.task;

public class InvalidTimeRangeException extends RuntimeException {

  public InvalidTimeRangeException() {
    super("End time must be after start time");
  }

  public InvalidTimeRangeException(String message) {
    super(message);
  }
}
