package de.unipassau.timetracking.task.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record CreateTaskRequest(
    @Size(max = 500) String description, @NotNull Instant startTime, @NotNull Instant endTime) {}
