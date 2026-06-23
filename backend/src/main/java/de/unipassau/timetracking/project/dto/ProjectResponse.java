package de.unipassau.timetracking.project.dto;

import de.unipassau.timetracking.project.Project;

public record ProjectResponse(Long id, String name, Long parentId, long totalSeconds) {

  public static ProjectResponse from(Project project, long totalSeconds) {
    return new ProjectResponse(
        project.getId(),
        project.getName(),
        project.getParent() != null ? project.getParent().getId() : null,
        totalSeconds);
  }
}
