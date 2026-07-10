package de.unipassau.timetracking.project;

import de.unipassau.timetracking.user.AppUser;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

  List<ProjectMember> findByProject(Project project);

  Optional<ProjectMember> findByProjectAndUser(Project project, AppUser user);

  boolean existsByProjectAndUser(Project project, AppUser user);

  void deleteByProject(Project project);

  @Query(
      "SELECT pm.project FROM ProjectMember pm WHERE pm.user = :user ORDER BY pm.project.name ASC")
  List<Project> findAccessibleProjectsByUser(@Param("user") AppUser user);

  @Query("SELECT pm.project FROM ProjectMember pm WHERE pm.project.id = :id AND pm.user = :user")
  Optional<Project> findAccessibleProjectByIdAndUser(
      @Param("id") Long id, @Param("user") AppUser user);
}
