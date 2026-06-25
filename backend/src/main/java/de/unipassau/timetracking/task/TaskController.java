package de.unipassau.timetracking.task;

import de.unipassau.timetracking.project.Project;
import de.unipassau.timetracking.project.ProjectNotFoundException;
import de.unipassau.timetracking.project.ProjectRepository;
import de.unipassau.timetracking.security.AppUserPrincipal;
import de.unipassau.timetracking.task.dto.CreateTaskRequest;
import de.unipassau.timetracking.task.dto.StartTaskRequest;
import de.unipassau.timetracking.task.dto.TaskResponse;
import de.unipassau.timetracking.task.dto.UpdateTaskRequest;
import de.unipassau.timetracking.user.AppUser;
import de.unipassau.timetracking.user.AppUserRepository;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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

/**
 * Transactional at the class level so the lazily-loaded {@code projects} association on a {@link
 * Task} is still accessible when {@link TaskResponse#from} reads it, instead of failing once the
 * repository call's own short-lived session has already closed.
 */
@RestController
@RequestMapping("/api/tasks")
@Transactional
public class TaskController {

  private final TaskRepository taskRepository;
  private final ProjectRepository projectRepository;
  private final AppUserRepository appUserRepository;

  public TaskController(
      TaskRepository taskRepository,
      ProjectRepository projectRepository,
      AppUserRepository appUserRepository) {
    this.taskRepository = taskRepository;
    this.projectRepository = projectRepository;
    this.appUserRepository = appUserRepository;
  }

  /**
   * Starting a task while another one is already running stops the running task at the current
   * moment and starts the new one, rather than rejecting the request. This mirrors common time
   * trackers (e.g. Toggl, Timewarrior) and keeps the "start" action a single click.
   */
  @PostMapping("/start")
  public ResponseEntity<TaskResponse> start(
      @Valid @RequestBody(required = false) StartTaskRequest request,
      Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Instant now = Instant.now();
    taskRepository
        .findByOwnerAndEndTimeIsNull(owner)
        .ifPresent(
            running -> {
              running.stop(now);
              taskRepository.save(running);
            });

    String description = request == null ? null : request.description();
    Task task = new Task(owner, description, now);
    taskRepository.save(task);
    return ResponseEntity.status(201).body(TaskResponse.from(task));
  }

  @PostMapping("/stop")
  public ResponseEntity<TaskResponse> stop(Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Task task =
        taskRepository.findByOwnerAndEndTimeIsNull(owner).orElseThrow(NoRunningTaskException::new);
    task.stop(Instant.now());
    taskRepository.save(task);
    return ResponseEntity.ok(TaskResponse.from(task));
  }

  @GetMapping("/current")
  public ResponseEntity<TaskResponse> current(Authentication authentication) {
    AppUser owner = currentUser(authentication);
    return taskRepository
        .findByOwnerAndEndTimeIsNull(owner)
        .map(task -> ResponseEntity.ok(TaskResponse.from(task)))
        .orElseGet(() -> ResponseEntity.noContent().build());
  }

  @PostMapping
  public ResponseEntity<TaskResponse> create(
      @Valid @RequestBody CreateTaskRequest request, Authentication authentication) {
    if (!request.endTime().isAfter(request.startTime())) {
      throw new InvalidTimeRangeException();
    }
    AppUser owner = currentUser(authentication);
    Task task = new Task(owner, request.description(), request.startTime());
    task.stop(request.endTime());
    task.setProjects(resolveProjects(request.projectIds(), owner));
    taskRepository.save(task);
    return ResponseEntity.status(201).body(TaskResponse.from(task));
  }

  /**
   * {@code from}/{@code to} are optional ISO-8601 instants that scope the list to tasks starting
   * within that window (start-inclusive, end-exclusive) - used for the current day/week/month
   * overviews, whose boundaries the frontend computes in the user's local timezone.
   */
  @GetMapping
  public List<TaskResponse> list(
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to,
      Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Instant fromInstant = TimeRange.parse(from);
    Instant toInstant = TimeRange.parse(to);
    TimeRange.validate(fromInstant, toInstant);
    return taskRepository.findByOwnerOrderByStartTimeDesc(owner).stream()
        .filter(task -> TimeRange.contains(task, fromInstant, toInstant))
        .map(TaskResponse::from)
        .toList();
  }

  /**
   * Editing can adjust a still-running task's times (e.g. correcting a forgotten start) without
   * stopping it, and can also set an end time to complete it as part of the edit. It cannot,
   * however, turn an already-completed task back into a running one (clear its end time) - that
   * would risk ending up with two tasks running at once, which only {@code /start} is allowed to
   * arbitrate.
   */
  @PutMapping("/{id}")
  public ResponseEntity<TaskResponse> update(
      @PathVariable Long id,
      @Valid @RequestBody UpdateTaskRequest request,
      Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Task task = taskRepository.findByIdAndOwner(id, owner).orElseThrow(TaskNotFoundException::new);

    if (request.endTime() == null && task.getEndTime() != null) {
      throw new InvalidTimeRangeException(
          "Cannot reopen a completed task; start a new one instead");
    }
    if (request.endTime() != null && !request.endTime().isAfter(request.startTime())) {
      throw new InvalidTimeRangeException();
    }

    task.update(request.description(), request.startTime(), request.endTime());
    task.setProjects(resolveProjects(request.projectIds(), owner));
    taskRepository.save(task);
    return ResponseEntity.ok(TaskResponse.from(task));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
    AppUser owner = currentUser(authentication);
    Task task = taskRepository.findByIdAndOwner(id, owner).orElseThrow(TaskNotFoundException::new);
    taskRepository.delete(task);
    return ResponseEntity.noContent().build();
  }

  private AppUser currentUser(Authentication authentication) {
    AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
    return appUserRepository.findByEmail(principal.getEmail()).orElseThrow();
  }

  private Set<Project> resolveProjects(Set<Long> projectIds, AppUser owner) {
    if (projectIds == null || projectIds.isEmpty()) {
      return new HashSet<>();
    }
    Set<Project> projects = new HashSet<>();
    for (Long id : projectIds) {
      projects.add(
          projectRepository.findByIdAndOwner(id, owner).orElseThrow(ProjectNotFoundException::new));
    }
    return projects;
  }
}
