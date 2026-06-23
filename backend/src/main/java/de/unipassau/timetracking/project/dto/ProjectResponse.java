package de.unipassau.timetracking.project.dto;

import de.unipassau.timetracking.project.Project;

public record ProjectResponse(Long id, String name) {

  public static ProjectResponse from(Project project) {
    return new ProjectResponse(project.getId(), project.getName());
  }
}
