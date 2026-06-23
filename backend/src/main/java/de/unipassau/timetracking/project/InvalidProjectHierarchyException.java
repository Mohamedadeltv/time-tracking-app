package de.unipassau.timetracking.project;

public class InvalidProjectHierarchyException extends RuntimeException {

  public InvalidProjectHierarchyException() {
    super("A project cannot be its own ancestor");
  }
}
