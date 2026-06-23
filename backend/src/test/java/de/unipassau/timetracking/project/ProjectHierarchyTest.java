package de.unipassau.timetracking.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
class ProjectHierarchyTest {

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

  private void createCompletedTask(
      MockHttpSession session, List<Long> projectIds, long hoursAgoStart, long hoursAgoEnd)
      throws Exception {
    Instant start = Instant.now().minus(hoursAgoStart, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(hoursAgoEnd, ChronoUnit.HOURS);
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
                            "projectIds", projectIds))))
        .andExpect(status().isCreated());
  }

  private JsonNode projectByName(MockHttpSession session, String name) throws Exception {
    MvcResult result = mockMvc.perform(get("/api/projects").session(session)).andReturn();
    JsonNode all = objectMapper.readTree(result.getResponse().getContentAsString());
    for (JsonNode node : all) {
      if (node.get("name").asText().equals(name)) {
        return node;
      }
    }
    throw new AssertionError("No project named " + name);
  }

  @Test
  void createWithAParentSetsTheParentId() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long courseId = createProject(session, "Course", null);

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Assignment 1", "parentId", courseId))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.parentId").value(courseId));
  }

  @Test
  void createWithAnUnknownParentReturnsNotFound() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Assignment", "parentId", 999999))))
        .andExpect(status().isNotFound());
  }

  @Test
  void createWithAnotherUsersParentReturnsNotFound() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession otherSession = registerAndGetSession(uniqueEmail());
    long courseId = createProject(ownerSession, "Course", null);

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(otherSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Assignment", "parentId", courseId))))
        .andExpect(status().isNotFound());
  }

  @Test
  void updateCanReparentAProject() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long a = createProject(session, "A", null);
    long b = createProject(session, "B", null);

    mockMvc
        .perform(
            put("/api/projects/" + b)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "B", "parentId", a))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.parentId").value(a));
  }

  @Test
  void updateCanRemoveTheParentToBecomeTopLevelAgain() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long a = createProject(session, "A", null);
    long b = createProject(session, "B", a);

    mockMvc
        .perform(
            put("/api/projects/" + b)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "B"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.parentId").doesNotExist());
  }

  @Test
  void updateRejectsSettingAProjectAsItsOwnParent() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long a = createProject(session, "A", null);

    mockMvc
        .perform(
            put("/api/projects/" + a)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "A", "parentId", a))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void updateRejectsSettingAProjectsParentToOneOfItsDescendants() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long grandparent = createProject(session, "Grandparent", null);
    long parent = createProject(session, "Parent", grandparent);
    long child = createProject(session, "Child", parent);

    mockMvc
        .perform(
            put("/api/projects/" + grandparent)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Grandparent", "parentId", child))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void deletingAParentOrphansItsDirectChildren() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long parent = createProject(session, "Parent", null);
    createProject(session, "Child", parent);

    mockMvc
        .perform(delete("/api/projects/" + parent).with(csrf()).session(session))
        .andExpect(status().isNoContent());

    JsonNode child = projectByName(session, "Child");
    assertThat(child.get("parentId").isNull()).isTrue();
  }

  @Test
  void totalSecondsSumsOwnAndDescendantTasks() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long parent = createProject(session, "Parent", null);
    long child = createProject(session, "Child", parent);

    createCompletedTask(session, List.of(parent), 3, 2); // 1 hour on the parent itself
    createCompletedTask(session, List.of(child), 4, 2); // 2 hours on the child

    JsonNode parentJson = projectByName(session, "Parent");
    JsonNode childJson = projectByName(session, "Child");
    assertThat(parentJson.get("totalSeconds").asLong()).isEqualTo(3 * 3600);
    assertThat(childJson.get("totalSeconds").asLong()).isEqualTo(2 * 3600);
  }

  @Test
  void totalSecondsDedupesATaskTaggedToTwoSubprojectsOfTheSameParent() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long parent = createProject(session, "Parent", null);
    long childA = createProject(session, "Child A", parent);
    long childB = createProject(session, "Child B", parent);

    createCompletedTask(session, List.of(childA, childB), 2, 0); // 2 hours, tagged to both

    JsonNode parentJson = projectByName(session, "Parent");
    JsonNode childAJson = projectByName(session, "Child A");
    JsonNode childBJson = projectByName(session, "Child B");
    assertThat(parentJson.get("totalSeconds").asLong()).isEqualTo(2 * 3600);
    assertThat(childAJson.get("totalSeconds").asLong()).isEqualTo(2 * 3600);
    assertThat(childBJson.get("totalSeconds").asLong()).isEqualTo(2 * 3600);
  }

  @Test
  void totalSecondsDedupesATaskTaggedToBothAParentAndItsChild() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long parent = createProject(session, "Parent", null);
    long child = createProject(session, "Child", parent);

    createCompletedTask(session, List.of(parent, child), 2, 0); // 2 hours, same lineage

    JsonNode parentJson = projectByName(session, "Parent");
    assertThat(parentJson.get("totalSeconds").asLong()).isEqualTo(2 * 3600);
  }

  @Test
  void totalSecondsSumsAcrossMultipleLevelsOfNesting() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long grandparent = createProject(session, "Grandparent", null);
    long parent = createProject(session, "Parent", grandparent);
    long child = createProject(session, "Child", parent);

    createCompletedTask(session, List.of(grandparent), 1, 0);
    createCompletedTask(session, List.of(parent), 2, 0);
    createCompletedTask(session, List.of(child), 3, 0);

    JsonNode grandparentJson = projectByName(session, "Grandparent");
    assertThat(grandparentJson.get("totalSeconds").asLong()).isEqualTo((1 + 2 + 3) * 3600);
  }

  @Test
  void totalSecondsExcludesARunningTask() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long projectId = createProject(session, "Project", null);

    mockMvc
        .perform(
            post("/api/tasks/start")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(Map.of("description", "Running", "projectIds", List.of(projectId)))))
        .andExpect(status().isCreated());

    JsonNode projectJson = projectByName(session, "Project");
    assertThat(projectJson.get("totalSeconds").asLong()).isEqualTo(0);
  }
}
