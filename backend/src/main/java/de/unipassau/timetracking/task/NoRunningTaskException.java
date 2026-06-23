package de.unipassau.timetracking.task;

public class NoRunningTaskException extends RuntimeException {

  public NoRunningTaskException() {
    super("No task is currently running");
  }
}
