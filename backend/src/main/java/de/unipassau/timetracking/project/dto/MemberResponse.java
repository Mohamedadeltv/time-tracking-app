package de.unipassau.timetracking.project.dto;

import de.unipassau.timetracking.project.ProjectMember;

public record MemberResponse(Long userId, String email, String role) {

  public static MemberResponse from(ProjectMember member) {
    return new MemberResponse(
        member.getUser().getId(), member.getUser().getEmail(), member.getRole().name());
  }
}
