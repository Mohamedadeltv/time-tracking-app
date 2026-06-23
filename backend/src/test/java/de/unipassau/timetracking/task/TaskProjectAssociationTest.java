package de.unipassau.timetracking.task;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
class TaskProjectAssociationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

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

  private long createProject(MockHttpSession session, String name) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/projects")
                    .with(csrf())
                    .session(session)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", name))))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
  }

  private long createTask(MockHttpSession session, List<Long> projectIds) throws Exception {
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/tasks")
                    .with(csrf())
                    .session(session)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        toJson(
                            Map.of(
                                "description",
                                "Task",
                                "startTime",
                                start.toString(),
                                "endTime",
                                end.toString(),
                                "projectIds",
                                projectIds))))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
  }

  @Test
  void createTaskAssociatesItWithTheGivenProjects() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long alpha = createProject(session, "Alpha");
    long beta = createProject(session, "Beta");

    long taskId = createTask(session, List.of(alpha, beta));

    mockMvc
        .perform(get("/api/tasks").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(taskId))
        .andExpect(jsonPath("$[0].projects.length()").value(2))
        .andExpect(jsonPath("$[0].projects[0].name").value("Alpha"))
        .andExpect(jsonPath("$[0].projects[1].name").value("Beta"));
  }

  @Test
  void createTaskWithoutProjectsHasAnEmptyProjectsList() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    long taskId = createTask(session, List.of());

    mockMvc
        .perform(get("/api/tasks").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(taskId))
        .andExpect(jsonPath("$[0].projects.length()").value(0));
  }

  @Test
  void createTaskRejectsAnUnknownProjectId() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    mockMvc
        .perform(
            post("/api/tasks")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(
                        Map.of(
                            "startTime", start.toString(),
                            "endTime", end.toString(),
                            "projectIds", List.of(999999)))))
        .andExpect(status().isNotFound());
  }

  @Test
  void createTaskRejectsAnotherUsersProjectId() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession otherSession = registerAndGetSession(uniqueEmail());
    long projectId = createProject(ownerSession, "Lecture");

    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    mockMvc
        .perform(
            post("/api/tasks")
                .with(csrf())
                .session(otherSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(
                        Map.of(
                            "startTime", start.toString(),
                            "endTime", end.toString(),
                            "projectIds", List.of(projectId)))))
        .andExpect(status().isNotFound());
  }

  @Test
  void updateTaskReplacesTheProjectAssociation() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long alpha = createProject(session, "Alpha");
    long beta = createProject(session, "Beta");
    long taskId = createTask(session, List.of(alpha));

    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    mockMvc
        .perform(
            put("/api/tasks/" + taskId)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(
                        Map.of(
                            "startTime", start.toString(),
                            "endTime", end.toString(),
                            "projectIds", List.of(beta)))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.projects.length()").value(1))
        .andExpect(jsonPath("$.projects[0].name").value("Beta"));
  }

  @Test
  void updateTaskCanClearAllProjectAssociations() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long alpha = createProject(session, "Alpha");
    long taskId = createTask(session, List.of(alpha));

    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    mockMvc
        .perform(
            put("/api/tasks/" + taskId)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("startTime", start.toString(), "endTime", end.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.projects.length()").value(0));
  }

  @Test
  void deletingAProjectRemovesItFromTasksWithoutDeletingTheTasks() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long alpha = createProject(session, "Alpha");
    long beta = createProject(session, "Beta");
    long taskId = createTask(session, List.of(alpha, beta));

    mockMvc
        .perform(delete("/api/projects/" + alpha).with(csrf()).session(session))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/tasks").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(taskId))
        .andExpect(jsonPath("$[0].projects.length()").value(1))
        .andExpect(jsonPath("$[0].projects[0].name").value("Beta"));
  }
}
