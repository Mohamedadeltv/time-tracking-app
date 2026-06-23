package de.unipassau.timetracking.task.dto;

import de.unipassau.timetracking.task.Task;
import java.time.Instant;

public record TaskResponse(
    Long id, String description, Instant startTime, Instant endTime, boolean running) {

  public static TaskResponse from(Task task) {
    return new TaskResponse(
        task.getId(),
        task.getDescription(),
        task.getStartTime(),
        task.getEndTime(),
        task.isRunning());
  }
}
