package de.unipassau.timetracking.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.unipassau.timetracking.user.AppUser;
import de.unipassau.timetracking.user.AppUserRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class TaskControllerTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private TaskRepository taskRepository;
  @Autowired private AppUserRepository appUserRepository;

  private static String uniqueEmail() {
    return "user-" + UUID.randomUUID() + "@example.com";
  }

  private MockHttpSession registerAndGetSession(String email) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/auth/register")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("email", email, "password", "password123"))))
            .andReturn();
    return (MockHttpSession) result.getRequest().getSession(false);
  }

  private String toJson(Object body) throws Exception {
    return objectMapper.writeValueAsString(body);
  }

  @Test
  void startCreatesRunningTask() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            post("/api/tasks/start")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("description", "Writing report"))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.description").value("Writing report"))
        .andExpect(jsonPath("$.running").value(true))
        .andExpect(jsonPath("$.endTime").doesNotExist());
  }

  @Test
  void startWithoutDescriptionIsAllowed() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(post("/api/tasks/start").with(csrf()).session(session))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.running").value(true));
  }

  @Test
  void startRejectsDescriptionTooLong() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            post("/api/tasks/start")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("description", "x".repeat(501)))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void startWhileRunningStopsThePreviousTaskAndStartsANewOne() throws Exception {
    String email = uniqueEmail();
    MockHttpSession session = registerAndGetSession(email);
    AppUser owner = appUserRepository.findByEmail(email).orElseThrow();

    mockMvc
        .perform(
            post("/api/tasks/start")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("description", "First"))))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            post("/api/tasks/start")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("description", "Second"))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.description").value("Second"));

    List<Task> tasks = taskRepository.findAll();
    Task first = tasks.stream().filter(t -> "First".equals(t.getDescription())).findFirst().get();
    Task second = tasks.stream().filter(t -> "Second".equals(t.getDescription())).findFirst().get();
    assertThat(first.isRunning()).isFalse();
    assertThat(second.isRunning()).isTrue();
    assertThat(taskRepository.findByOwnerAndEndTimeIsNull(owner).map(Task::getId))
        .contains(second.getId());
  }

  @Test
  void stopStopsTheRunningTask() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    mockMvc.perform(post("/api/tasks/start").with(csrf()).session(session));

    mockMvc
        .perform(post("/api/tasks/stop").with(csrf()).session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.running").value(false))
        .andExpect(jsonPath("$.endTime").exists());
  }

  @Test
  void stopWithoutARunningTaskReturnsConflict() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(post("/api/tasks/stop").with(csrf()).session(session))
        .andExpect(status().isConflict());
  }

  @Test
  void currentReturnsTheRunningTask() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    mockMvc.perform(
        post("/api/tasks/start")
            .with(csrf())
            .session(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("description", "Reading"))));

    mockMvc
        .perform(get("/api/tasks/current").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.description").value("Reading"))
        .andExpect(jsonPath("$.running").value(true));
  }

  @Test
  void currentReturnsNoContentWhenNothingIsRunning() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc.perform(get("/api/tasks/current").session(session)).andExpect(status().isNoContent());
  }

  /**
   * The running task lives in the database keyed by the user, not in any in-memory/session state,
   * so it is found again from a brand-new session after re-authenticating - the same way it would
   * be found again after restarting the server or browser.
   */
  @Test
  void currentTaskSurvivesARelogin() throws Exception {
    String email = uniqueEmail();
    String password = "password123";
    MockHttpSession firstSession = registerAndGetSession(email);
    mockMvc.perform(
        post("/api/tasks/start")
            .with(csrf())
            .session(firstSession)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("description", "Persisted task"))));

    MvcResult loginResult =
        mockMvc
            .perform(
                post("/api/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("email", email, "password", password))))
            .andReturn();
    MockHttpSession newSession = (MockHttpSession) loginResult.getRequest().getSession(false);

    mockMvc
        .perform(get("/api/tasks/current").session(newSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.description").value("Persisted task"));
  }

  @Test
  void taskEndpointsRejectUnauthenticatedRequests() throws Exception {
    mockMvc.perform(post("/api/tasks/start").with(csrf())).andExpect(status().isUnauthorized());
    mockMvc.perform(post("/api/tasks/stop").with(csrf())).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/tasks/current")).andExpect(status().isUnauthorized());
  }
}
