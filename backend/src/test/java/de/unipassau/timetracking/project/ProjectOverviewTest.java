package de.unipassau.timetracking.project;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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
class ProjectOverviewTest {

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

  private long createProject(MockHttpSession session, String name, Long parentId) throws Exception {
    Map<String, Object> body =
        parentId == null ? Map.of("name", name) : Map.of("name", name, "parentId", parentId);
    MvcResult result =
        mockMvc
            .perform(
                post("/api/projects")
                    .with(csrf())
                    .session(session)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(body)))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
  }

  private long createCompletedTask(
      MockHttpSession session,
      String description,
      List<Long> projectIds,
      Instant start,
      Instant end)
      throws Exception {
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
                                description,
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
  void overviewIncludesTasksOfTheProjectAndItsSubprojects() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant now = Instant.now();
    long parent = createProject(session, "Parent", null);
    long child = createProject(session, "Child", parent);
    createCompletedTask(
        session,
        "On parent",
        List.of(parent),
        now.minus(3, ChronoUnit.HOURS),
        now.minus(2, ChronoUnit.HOURS));
    createCompletedTask(
        session,
        "On child",
        List.of(child),
        now.minus(4, ChronoUnit.HOURS),
        now.minus(2, ChronoUnit.HOURS));

    mockMvc
        .perform(get("/api/projects/" + parent + "/overview").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.projectName").value("Parent"))
        .andExpect(jsonPath("$.totalSeconds").value(3 * 3600))
        .andExpect(jsonPath("$.tasks.length()").value(2));
  }

  @Test
  void overviewDedupesATaskTaggedToTwoSubprojectsOfTheSameParent() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant now = Instant.now();
    long parent = createProject(session, "Parent", null);
    long childA = createProject(session, "Child A", parent);
    long childB = createProject(session, "Child B", parent);
    createCompletedTask(
        session, "Shared", List.of(childA, childB), now.minus(2, ChronoUnit.HOURS), now);

    mockMvc
        .perform(get("/api/projects/" + parent + "/overview").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalSeconds").value(2 * 3600))
        .andExpect(jsonPath("$.tasks.length()").value(1));
  }

  @Test
  void overviewFiltersTasksByFromAndTo() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant now = Instant.now();
    long project = createProject(session, "Project", null);
    createCompletedTask(
        session,
        "Old",
        List.of(project),
        now.minus(3, ChronoUnit.DAYS),
        now.minus(3, ChronoUnit.DAYS).plus(1, ChronoUnit.HOURS));
    long recentId =
        createCompletedTask(
            session, "Recent", List.of(project), now.minus(1, ChronoUnit.HOURS), now);

    mockMvc
        .perform(
            get("/api/projects/" + project + "/overview")
                .session(session)
                .param("from", now.minus(2, ChronoUnit.HOURS).toString())
                .param("to", now.plus(1, ChronoUnit.HOURS).toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalSeconds").value(3600))
        .andExpect(jsonPath("$.tasks.length()").value(1))
        .andExpect(jsonPath("$.tasks[0].id").value(recentId));
  }

  @Test
  void overviewExcludesARunningTaskFromTheTotalButListsIt() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long project = createProject(session, "Project", null);

    MvcResult startResult =
        mockMvc
            .perform(post("/api/tasks/start").with(csrf()).session(session))
            .andExpect(status().isCreated())
            .andReturn();
    JsonNode started = objectMapper.readTree(startResult.getResponse().getContentAsString());
    long taskId = started.get("id").asLong();
    String startTime = started.get("startTime").asText();

    // Tagging a project onto an already-running task happens through the regular task edit flow
    // (PUT without an endTime keeps it running) - /start itself does not take projectIds.
    mockMvc
        .perform(
            put("/api/tasks/" + taskId)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("startTime", startTime, "projectIds", List.of(project)))))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/api/projects/" + project + "/overview").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalSeconds").value(0))
        .andExpect(jsonPath("$.tasks.length()").value(1))
        .andExpect(jsonPath("$.tasks[0].running").value(true));
  }

  @Test
  void overviewReturnsNotFoundForAnUnknownProject() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(get("/api/projects/999999/overview").session(session))
        .andExpect(status().isNotFound());
  }

  @Test
  void overviewReturnsNotFoundForAnotherUsersProject() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession otherSession = registerAndGetSession(uniqueEmail());
    long project = createProject(ownerSession, "Project", null);

    mockMvc
        .perform(get("/api/projects/" + project + "/overview").session(otherSession))
        .andExpect(status().isNotFound());
  }

  @Test
  void overviewRejectsAToThatIsNotAfterFrom() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long project = createProject(session, "Project", null);
    Instant now = Instant.now();

    mockMvc
        .perform(
            get("/api/projects/" + project + "/overview")
                .session(session)
                .param("from", now.toString())
                .param("to", now.minus(1, ChronoUnit.HOURS).toString()))
        .andExpect(status().isBadRequest());
  }

  @Test
  void overviewRejectsAnUnparsableFrom() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long project = createProject(session, "Project", null);

    mockMvc
        .perform(
            get("/api/projects/" + project + "/overview")
                .session(session)
                .param("from", "nonsense"))
        .andExpect(status().isBadRequest());
  }
}
