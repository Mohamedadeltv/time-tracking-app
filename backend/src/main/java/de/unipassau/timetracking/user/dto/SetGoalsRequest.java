package de.unipassau.timetracking.user.dto;

import jakarta.validation.constraints.Min;

public record SetGoalsRequest(@Min(1) Long dailyGoalHours, @Min(1) Long weeklyGoalHours) {}
