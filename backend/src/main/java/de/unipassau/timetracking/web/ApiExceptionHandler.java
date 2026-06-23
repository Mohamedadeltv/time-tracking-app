package de.unipassau.timetracking.web;

import de.unipassau.timetracking.project.InvalidProjectHierarchyException;
import de.unipassau.timetracking.project.ProjectNameAlreadyInUseException;
import de.unipassau.timetracking.project.ProjectNotFoundException;
import de.unipassau.timetracking.task.InvalidTimeRangeException;
import de.unipassau.timetracking.task.NoRunningTaskException;
import de.unipassau.timetracking.task.TaskNotFoundException;
import de.unipassau.timetracking.user.EmailAlreadyInUseException;
import de.unipassau.timetracking.user.InvalidCurrentPasswordException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
    Map<String, String> fieldErrors = new LinkedHashMap<>();
    ex.getBindingResult()
        .getFieldErrors()
        .forEach(error -> fieldErrors.put(error.getField(), error.getDefaultMessage()));
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("message", "Validation failed");
    body.put("errors", fieldErrors);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  @ExceptionHandler(EmailAlreadyInUseException.class)
  public ResponseEntity<Map<String, String>> handleEmailAlreadyInUse(
      EmailAlreadyInUseException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", ex.getMessage()));
  }

  @ExceptionHandler(InvalidCurrentPasswordException.class)
  public ResponseEntity<Map<String, String>> handleInvalidCurrentPassword(
      InvalidCurrentPasswordException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", ex.getMessage()));
  }

  @ExceptionHandler(NoRunningTaskException.class)
  public ResponseEntity<Map<String, String>> handleNoRunningTask(NoRunningTaskException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", ex.getMessage()));
  }

  @ExceptionHandler(InvalidTimeRangeException.class)
  public ResponseEntity<Map<String, String>> handleInvalidTimeRange(InvalidTimeRangeException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", ex.getMessage()));
  }

  @ExceptionHandler(TaskNotFoundException.class)
  public ResponseEntity<Map<String, String>> handleTaskNotFound(TaskNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", ex.getMessage()));
  }

  @ExceptionHandler(ProjectNotFoundException.class)
  public ResponseEntity<Map<String, String>> handleProjectNotFound(ProjectNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", ex.getMessage()));
  }

  @ExceptionHandler(ProjectNameAlreadyInUseException.class)
  public ResponseEntity<Map<String, String>> handleProjectNameAlreadyInUse(
      ProjectNameAlreadyInUseException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", ex.getMessage()));
  }

  @ExceptionHandler(InvalidProjectHierarchyException.class)
  public ResponseEntity<Map<String, String>> handleInvalidProjectHierarchy(
      InvalidProjectHierarchyException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", ex.getMessage()));
  }

  @ExceptionHandler(AuthenticationException.class)
  public ResponseEntity<Map<String, String>> handleAuthenticationException(
      AuthenticationException ex) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("message", "Invalid email or password"));
  }
}
