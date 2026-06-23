package de.unipassau.timetracking.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateProjectRequest(@NotBlank @Size(max = 200) String name) {}
