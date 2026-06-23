package de.unipassau.timetracking.task;

import de.unipassau.timetracking.security.AppUserPrincipal;
import de.unipassau.timetracking.task.dto.StartTaskRequest;
import de.unipassau.timetracking.task.dto.TaskResponse;
import de.unipassau.timetracking.user.AppUser;
import de.unipassau.timetracking.user.AppUserRepository;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

  private final TaskRepository taskRepository;
  private final AppUserRepository appUserRepository;

  public TaskController(TaskRepository taskRepository, AppUserRepository appUserRepository) {
    this.taskRepository = taskRepository;
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

  private AppUser currentUser(Authentication authentication) {
    AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
    return appUserRepository.findByEmail(principal.getEmail()).orElseThrow();
  }
}
