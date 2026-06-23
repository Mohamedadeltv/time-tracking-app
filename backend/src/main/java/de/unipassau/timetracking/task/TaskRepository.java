package de.unipassau.timetracking.task;

import de.unipassau.timetracking.user.AppUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskRepository extends JpaRepository<Task, Long> {

  Optional<Task> findByOwnerAndEndTimeIsNull(AppUser owner);
}
