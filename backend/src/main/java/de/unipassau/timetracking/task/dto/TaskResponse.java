package de.unipassau.timetracking.task.dto;

import de.unipassau.timetracking.project.dto.ProjectResponse;
import de.unipassau.timetracking.task.Task;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

public record TaskResponse(
    Long id,
    String description,
    Instant startTime,
    Instant endTime,
    boolean running,
    List<ProjectResponse> projects) {

  public static TaskResponse from(Task task) {
    return new TaskResponse(
        task.getId(),
        task.getDescription(),
        task.getStartTime(),
        task.getEndTime(),
        task.isRunning(),
        task.getProjects().stream()
            .map(ProjectResponse::from)
            .sorted(Comparator.comparing(ProjectResponse::name))
            .toList());
  }
}
