package de.unipassau.timetracking.task.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** {@code endTime} may be {@code null} to mean "still running". */
public record UpdateTaskRequest(
    @Size(max = 500) String description, @NotNull Instant startTime, Instant endTime) {}
