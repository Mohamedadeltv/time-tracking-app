package de.unipassau.timetracking.project;

import de.unipassau.timetracking.project.dto.CreateProjectRequest;
import de.unipassau.timetracking.project.dto.ProjectOverviewResponse;
import de.unipassau.timetracking.project.dto.ProjectResponse;
import de.unipassau.timetracking.project.dto.UpdateProjectRequest;
import de.unipassau.timetracking.security.AppUserPrincipal;
import de.unipassau.timetracking.task.Task;
import de.unipassau.timetracking.task.TaskRepository;
import de.unipassau.timetracking.task.TimeRange;
import de.unipassau.timetracking.task.dto.TaskResponse;
import de.unipassau.timetracking.user.AppUser;
import de.unipassau.timetracking.user.AppUserRepository;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
@Transactional
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
    project.setParent(resolveParent(request.parentId(), owner));
    projectRepository.save(project);
    // A brand-new project cannot yet be associated with any task, so its rolled-up total is 0.
    return ResponseEntity.status(201).body(ProjectResponse.from(project, 0));
  }

  @GetMapping
  public List<ProjectResponse> list(Authentication authentication) {
    AppUser owner = currentUser(authentication);
    List<Project> all = projectRepository.findByOwnerOrderByNameAsc(owner);
    Map<Long, List<Project>> childrenByParentId = childrenByParentId(all);
    return all.stream()
        .map(
            project ->
                ProjectResponse.from(project, totalSecondsFor(project, childrenByParentId, owner)))
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
    Project newParent = resolveParent(request.parentId(), owner);
    if (newParent != null) {
      rejectIfCyclic(project, newParent);
    }
    project.rename(request.name());
    project.setParent(newParent);
    projectRepository.save(project);

    List<Project> all = projectRepository.findByOwnerOrderByNameAsc(owner);
    return ResponseEntity.ok(
        ProjectResponse.from(project, totalSecondsFor(project, childrenByParentId(all), owner)));
  }

  /**
   * Deleting a project drops its task associations rather than the tasks themselves, and orphans
   * (rather than cascade-deletes) its direct subprojects by promoting them to top-level.
   */
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Project project =
        projectRepository.findByIdAndOwner(id, owner).orElseThrow(ProjectNotFoundException::new);

    List<Project> children =
        projectRepository.findByOwnerOrderByNameAsc(owner).stream()
            .filter(p -> p.getParent() != null && p.getParent().getId().equals(project.getId()))
            .toList();
    children.forEach(child -> child.setParent(null));
    projectRepository.saveAll(children);

    List<Task> tasks = taskRepository.findByOwnerAndProjectsContaining(owner, project);
    tasks.forEach(task -> task.getProjects().remove(project));
    taskRepository.saveAll(tasks);

    projectRepository.delete(project);
    return ResponseEntity.noContent().build();
  }

  /**
   * The tasks of a project and all its descendant subprojects (deduplicated, see {@link
   * #totalSecondsFor}), optionally restricted to those starting within {@code from}/{@code to},
   * together with the rolled-up total over that same filtered set.
   */
  @GetMapping("/{id}/overview")
  public ProjectOverviewResponse overview(
      @PathVariable Long id,
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to,
      Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Project project =
        projectRepository.findByIdAndOwner(id, owner).orElseThrow(ProjectNotFoundException::new);
    Instant fromInstant = TimeRange.parse(from);
    Instant toInstant = TimeRange.parse(to);
    TimeRange.validate(fromInstant, toInstant);

    List<Project> all = projectRepository.findByOwnerOrderByNameAsc(owner);
    Set<Project> subtree = subtreeOf(project, childrenByParentId(all));
    List<Task> tasks =
        taskRepository.findDistinctByOwnerAndProjectsIn(owner, subtree).stream()
            .filter(task -> TimeRange.contains(task, fromInstant, toInstant))
            .sorted(Comparator.comparing(Task::getStartTime).reversed())
            .toList();

    long totalSeconds =
        tasks.stream()
            .filter(task -> task.getEndTime() != null)
            .mapToLong(
                task -> Duration.between(task.getStartTime(), task.getEndTime()).getSeconds())
            .sum();

    return new ProjectOverviewResponse(
        project.getId(),
        project.getName(),
        totalSeconds,
        tasks.stream().map(TaskResponse::from).toList());
  }

  private Project resolveParent(Long parentId, AppUser owner) {
    if (parentId == null) {
      return null;
    }
    return projectRepository
        .findByIdAndOwner(parentId, owner)
        .orElseThrow(ProjectNotFoundException::new);
  }

  private void rejectIfCyclic(Project project, Project candidateParent) {
    Project current = candidateParent;
    while (current != null) {
      if (current.getId().equals(project.getId())) {
        throw new InvalidProjectHierarchyException();
      }
      current = current.getParent();
    }
  }

  private Map<Long, List<Project>> childrenByParentId(List<Project> all) {
    return all.stream()
        .filter(p -> p.getParent() != null)
        .collect(Collectors.groupingBy(p -> p.getParent().getId()));
  }

  /**
   * Sums the durations of every distinct completed task associated with this project or any of its
   * descendant subprojects. Collecting the tasks into a {@link Set} first - rather than summing
   * per-project - is what makes a task tagged to multiple subprojects of the same parent count only
   * once towards that parent.
   */
  private long totalSecondsFor(
      Project root, Map<Long, List<Project>> childrenByParentId, AppUser owner) {
    Set<Project> subtree = subtreeOf(root, childrenByParentId);
    return taskRepository.findDistinctByOwnerAndProjectsIn(owner, subtree).stream()
        .filter(task -> task.getEndTime() != null)
        .mapToLong(task -> Duration.between(task.getStartTime(), task.getEndTime()).getSeconds())
        .sum();
  }

  private Set<Project> subtreeOf(Project root, Map<Long, List<Project>> childrenByParentId) {
    Set<Project> subtree = new HashSet<>();
    Deque<Project> toVisit = new ArrayDeque<>();
    toVisit.push(root);
    while (!toVisit.isEmpty()) {
      Project current = toVisit.pop();
      if (subtree.add(current)) {
        childrenByParentId.getOrDefault(current.getId(), List.of()).forEach(toVisit::push);
      }
    }
    return subtree;
  }

  private AppUser currentUser(Authentication authentication) {
    AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
    return appUserRepository.findByEmail(principal.getEmail()).orElseThrow();
  }
}
