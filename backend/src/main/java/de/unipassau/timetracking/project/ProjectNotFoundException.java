package de.unipassau.timetracking.project;

public class ProjectNotFoundException extends RuntimeException {

  public ProjectNotFoundException() {
    super("Project not found");
  }
}
