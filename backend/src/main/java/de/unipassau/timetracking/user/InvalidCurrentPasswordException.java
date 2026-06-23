package de.unipassau.timetracking.user;

public class InvalidCurrentPasswordException extends RuntimeException {

  public InvalidCurrentPasswordException() {
    super("Current password is incorrect");
  }
}
