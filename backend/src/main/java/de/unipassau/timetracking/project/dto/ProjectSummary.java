package de.unipassau.timetracking.project.dto;

import de.unipassau.timetracking.project.Project;

/** A lightweight project reference, e.g. for the list of projects nested inside a task. */
public record ProjectSummary(Long id, String name) {

  public static ProjectSummary from(Project project) {
    return new ProjectSummary(project.getId(), project.getName());
  }
}
