package de.unipassau.timetracking.project;

public class ProjectNameAlreadyInUseException extends RuntimeException {

  public ProjectNameAlreadyInUseException(String name) {
    super("Project name already in use: " + name);
  }
}
