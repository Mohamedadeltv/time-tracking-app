package de.unipassau.timetracking.user.dto;

import jakarta.validation.constraints.NotBlank;

public record SetTimezoneRequest(@NotBlank String timezone) {}
