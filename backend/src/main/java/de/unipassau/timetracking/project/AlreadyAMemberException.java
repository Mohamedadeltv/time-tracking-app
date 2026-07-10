package de.unipassau.timetracking.project;

public class AlreadyAMemberException extends RuntimeException {
  public AlreadyAMemberException() {
    super("User is already a member of this project");
  }
}
