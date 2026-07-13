package de.unipassau.timetracking.task.dto;

import de.unipassau.timetracking.project.dto.ProjectSummary;
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
    List<ProjectSummary> projects,
    List<String> tags) {

  public static TaskResponse from(Task task) {
    return new TaskResponse(
        task.getId(),
        task.getDescription(),
        task.getStartTime(),
        task.getEndTime(),
        task.isRunning(),
        task.getProjects().stream()
            .map(ProjectSummary::from)
            .sorted(Comparator.comparing(ProjectSummary::name))
            .toList(),
        task.getTags().stream().sorted().toList());
  }
}
