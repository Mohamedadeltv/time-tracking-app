package de.unipassau.timetracking.project;

import de.unipassau.timetracking.project.dto.CreateProjectRequest;
import de.unipassau.timetracking.project.dto.InviteMemberRequest;
import de.unipassau.timetracking.project.dto.MemberResponse;
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
import de.unipassau.timetracking.user.UserNotFoundException;
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
  private final ProjectMemberRepository projectMemberRepository;
  private final TaskRepository taskRepository;
  private final AppUserRepository appUserRepository;

  public ProjectController(
      ProjectRepository projectRepository,
      ProjectMemberRepository projectMemberRepository,
      TaskRepository taskRepository,
      AppUserRepository appUserRepository) {
    this.projectRepository = projectRepository;
    this.projectMemberRepository = projectMemberRepository;
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
    projectMemberRepository.save(new ProjectMember(project, owner, ProjectRole.OWNER));
    return ResponseEntity.status(201).body(ProjectResponse.from(project, 0));
  }

  @GetMapping
  public List<ProjectResponse> list(Authentication authentication) {
    AppUser user = currentUser(authentication);
    List<Project> all = projectMemberRepository.findAccessibleProjectsByUser(user);
    Map<Long, List<Project>> childrenByParentId = childrenByParentId(all);
    return all.stream()
        .map(project -> ProjectResponse.from(project, totalSecondsFor(project, childrenByParentId)))
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

    List<Project> all = projectMemberRepository.findAccessibleProjectsByUser(owner);
    return ResponseEntity.ok(
        ProjectResponse.from(project, totalSecondsFor(project, childrenByParentId(all))));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Project project =
        projectRepository.findByIdAndOwner(id, owner).orElseThrow(ProjectNotFoundException::new);

    List<Project> children =
        projectMemberRepository.findAccessibleProjectsByUser(owner).stream()
            .filter(p -> p.getParent() != null && p.getParent().getId().equals(project.getId()))
            .toList();
    children.forEach(child -> child.setParent(null));
    projectRepository.saveAll(children);

    List<Task> tasks = taskRepository.findByOwnerAndProjectsContaining(owner, project);
    tasks.forEach(task -> task.getProjects().remove(project));
    taskRepository.saveAll(tasks);

    projectMemberRepository.deleteByProject(project);
    projectRepository.delete(project);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/{id}/overview")
  public ProjectOverviewResponse overview(
      @PathVariable Long id,
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to,
      @RequestParam(required = false) Long userId,
      Authentication authentication) {
    AppUser user = currentUser(authentication);
    Project project =
        projectMemberRepository
            .findAccessibleProjectByIdAndUser(id, user)
            .orElseThrow(ProjectNotFoundException::new);
    Instant fromInstant = TimeRange.parse(from);
    Instant toInstant = TimeRange.parse(to);
    TimeRange.validate(fromInstant, toInstant);

    List<Project> all = projectMemberRepository.findAccessibleProjectsByUser(user);
    Set<Project> subtree = subtreeOf(project, childrenByParentId(all));

    List<Task> tasks =
        taskRepository.findDistinctByProjectsIn(subtree).stream()
            .filter(task -> userId == null || task.getOwner().getId().equals(userId))
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

  @PostMapping("/{id}/members")
  public ResponseEntity<MemberResponse> inviteMember(
      @PathVariable Long id,
      @Valid @RequestBody InviteMemberRequest request,
      Authentication authentication) {
    AppUser requester = currentUser(authentication);
    Project project =
        projectMemberRepository
            .findAccessibleProjectByIdAndUser(id, requester)
            .orElseThrow(ProjectNotFoundException::new);
    requireOwner(project, requester);

    AppUser invitee =
        appUserRepository.findByEmail(request.email()).orElseThrow(UserNotFoundException::new);
    if (projectMemberRepository.existsByProjectAndUser(project, invitee)) {
      throw new AlreadyAMemberException();
    }
    ProjectMember member = new ProjectMember(project, invitee, ProjectRole.MEMBER);
    projectMemberRepository.save(member);
    return ResponseEntity.status(201).body(MemberResponse.from(member));
  }

  @DeleteMapping("/{id}/members/{userId}")
  public ResponseEntity<Void> removeMember(
      @PathVariable Long id, @PathVariable Long userId, Authentication authentication) {
    AppUser requester = currentUser(authentication);
    Project project =
        projectMemberRepository
            .findAccessibleProjectByIdAndUser(id, requester)
            .orElseThrow(ProjectNotFoundException::new);
    requireOwner(project, requester);

    AppUser target = appUserRepository.findById(userId).orElseThrow(UserNotFoundException::new);
    if (target.getId().equals(requester.getId())) {
      throw new AlreadyAMemberException();
    }
    ProjectMember membership =
        projectMemberRepository
            .findByProjectAndUser(project, target)
            .orElseThrow(UserNotFoundException::new);
    projectMemberRepository.delete(membership);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/{id}/members")
  public List<MemberResponse> listMembers(@PathVariable Long id, Authentication authentication) {
    AppUser user = currentUser(authentication);
    Project project =
        projectMemberRepository
            .findAccessibleProjectByIdAndUser(id, user)
            .orElseThrow(ProjectNotFoundException::new);
    return projectMemberRepository.findByProject(project).stream()
        .map(MemberResponse::from)
        .toList();
  }

  private void requireOwner(Project project, AppUser user) {
    if (!project.getOwner().getId().equals(user.getId())) {
      throw new ProjectNotFoundException();
    }
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

  private long totalSecondsFor(Project root, Map<Long, List<Project>> childrenByParentId) {
    Set<Project> subtree = subtreeOf(root, childrenByParentId);
    return taskRepository.findDistinctByProjectsIn(subtree).stream()
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
