package de.unipassau.timetracking.user;

public class InvalidTimezoneException extends RuntimeException {
  public InvalidTimezoneException(String timezone) {
    super("Unknown timezone: " + timezone);
  }
}
