package de.unipassau.timetracking.task;

import de.unipassau.timetracking.project.Project;
import de.unipassau.timetracking.user.AppUser;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskRepository extends JpaRepository<Task, Long> {

  Optional<Task> findByOwnerAndEndTimeIsNull(AppUser owner);

  List<Task> findByOwnerOrderByStartTimeDesc(AppUser owner);

  Optional<Task> findByIdAndOwner(Long id, AppUser owner);

  List<Task> findByOwnerAndProjectsContaining(AppUser owner, Project project);

  List<Task> findDistinctByOwnerAndProjectsIn(AppUser owner, Collection<Project> projects);

  List<Task> findDistinctByProjectsIn(Collection<Project> projects);
}
