package de.unipassau.timetracking.user.dto;

import de.unipassau.timetracking.user.AppUser;

public record UserResponse(Long id, String email, String timezone) {

  public static UserResponse from(AppUser user) {
    return new UserResponse(user.getId(), user.getEmail(), user.getPreferredTimezone());
  }
}
