package de.unipassau.timetracking.task.dto;

import jakarta.validation.constraints.Size;

public record StartTaskRequest(@Size(max = 500) String description) {}
