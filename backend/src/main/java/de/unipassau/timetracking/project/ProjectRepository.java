package de.unipassau.timetracking.project;

import de.unipassau.timetracking.user.AppUser;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {

  List<Project> findByOwnerOrderByNameAsc(AppUser owner);

  Optional<Project> findByIdAndOwner(Long id, AppUser owner);

  boolean existsByOwnerAndNameIgnoreCase(AppUser owner, String name);
}
