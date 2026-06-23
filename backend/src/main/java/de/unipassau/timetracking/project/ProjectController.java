package de.unipassau.timetracking.project;

import de.unipassau.timetracking.project.dto.CreateProjectRequest;
import de.unipassau.timetracking.project.dto.ProjectResponse;
import de.unipassau.timetracking.project.dto.UpdateProjectRequest;
import de.unipassau.timetracking.security.AppUserPrincipal;
import de.unipassau.timetracking.task.Task;
import de.unipassau.timetracking.task.TaskRepository;
import de.unipassau.timetracking.user.AppUser;
import de.unipassau.timetracking.user.AppUserRepository;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

  private final ProjectRepository projectRepository;
  private final TaskRepository taskRepository;
  private final AppUserRepository appUserRepository;

  public ProjectController(
      ProjectRepository projectRepository,
      TaskRepository taskRepository,
      AppUserRepository appUserRepository) {
    this.projectRepository = projectRepository;
    this.taskRepository = taskRepository;
    this.appUserRepository = appUserRepository;
  }

  @PostMapping
  public ResponseEntity<ProjectResponse> create(
      @Valid @RequestBody CreateProjectRequest request, Authentication authentication) {
    AppUser owner = currentUser(authentication);
    if (projectRepository.existsByOwnerAndNameIgnoreCase(owner, request.name())) {
      throw new ProjectNameAlreadyInUseException(request.name());
    }
    Project project = new Project(owner, request.name());
    projectRepository.save(project);
    return ResponseEntity.status(201).body(ProjectResponse.from(project));
  }

  @GetMapping
  public List<ProjectResponse> list(Authentication authentication) {
    AppUser owner = currentUser(authentication);
    return projectRepository.findByOwnerOrderByNameAsc(owner).stream()
        .map(ProjectResponse::from)
        .toList();
  }

  @PutMapping("/{id}")
  public ResponseEntity<ProjectResponse> update(
      @PathVariable Long id,
      @Valid @RequestBody UpdateProjectRequest request,
      Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Project project =
        projectRepository.findByIdAndOwner(id, owner).orElseThrow(ProjectNotFoundException::new);
    if (!project.getName().equalsIgnoreCase(request.name())
        && projectRepository.existsByOwnerAndNameIgnoreCase(owner, request.name())) {
      throw new ProjectNameAlreadyInUseException(request.name());
    }
    project.rename(request.name());
    projectRepository.save(project);
    return ResponseEntity.ok(ProjectResponse.from(project));
  }

  /** Deleting a project drops its task associations rather than the tasks themselves. */
  @Transactional
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Project project =
        projectRepository.findByIdAndOwner(id, owner).orElseThrow(ProjectNotFoundException::new);
    List<Task> tasks = taskRepository.findByOwnerAndProjectsContaining(owner, project);
    tasks.forEach(task -> task.getProjects().remove(project));
    taskRepository.saveAll(tasks);
    projectRepository.delete(project);
    return ResponseEntity.noContent().build();
  }

  private AppUser currentUser(Authentication authentication) {
    AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
    return appUserRepository.findByEmail(principal.getEmail()).orElseThrow();
  }
}
