package de.unipassau.timetracking.project.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateProjectRequest(
    @NotBlank @Size(max = 200) String name, Long parentId, @Min(1) Long budgetHours) {}
