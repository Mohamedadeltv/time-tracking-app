package de.unipassau.timetracking.task;

public class TaskNotFoundException extends RuntimeException {

  public TaskNotFoundException() {
    super("Task not found");
  }
}
