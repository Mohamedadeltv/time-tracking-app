package de.unipassau.timetracking.user.dto;

import de.unipassau.timetracking.user.AppUser;

public record UserResponse(
    Long id, String email, String timezone, Long dailyGoalHours, Long weeklyGoalHours) {

  public static UserResponse from(AppUser user) {
    return new UserResponse(
        user.getId(),
        user.getEmail(),
        user.getPreferredTimezone(),
        user.getDailyGoalHours(),
        user.getWeeklyGoalHours());
  }
}
