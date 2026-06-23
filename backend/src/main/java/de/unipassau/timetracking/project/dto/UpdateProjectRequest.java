package de.unipassau.timetracking.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code parentId} may be {@code null} to make the project top-level. */
public record UpdateProjectRequest(@NotBlank @Size(max = 200) String name, Long parentId) {}
