package de.unipassau.timetracking.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import org.hamcrest.Matchers;
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
class ProjectExportTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static String uniqueEmail() {
    return "export-" + UUID.randomUUID() + "@example.com";
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

  private void createTask(
      MockHttpSession session, String description, Instant start, Instant end, long projectId)
      throws Exception {
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
                            new long[] {projectId}))))
        .andExpect(status().isCreated());
  }

  private String toJson(Object body) throws Exception {
    return objectMapper.writeValueAsString(body);
  }

  @Test
  void csvExportContainsHeaderAndTaskRows() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long projectId = createProject(session, "Export Test " + UUID.randomUUID());
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MILLIS);
    Instant end = start.plus(1, ChronoUnit.HOURS);
    createTask(session, "Write docs", start, end, projectId);

    MvcResult result =
        mockMvc
            .perform(get("/api/projects/" + projectId + "/export").session(session))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "text/csv"))
            .andExpect(
                header().string("Content-Disposition", Matchers.containsString("attachment")))
            .andReturn();

    String csv = result.getResponse().getContentAsString();
    assertThat(csv).startsWith("startTime,endTime,durationSeconds,description,projects,user");
    assertThat(csv).contains(start.toString());
    assertThat(csv).contains("Write docs");
    assertThat(csv).contains("3600");
  }

  @Test
  void jsonExportReturnsStructuredArray() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long projectId = createProject(session, "JSON Export " + UUID.randomUUID());
    Instant start = Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MILLIS);
    Instant end = start.plus(30, ChronoUnit.MINUTES);
    createTask(session, "Plan sprint", start, end, projectId);

    MvcResult result =
        mockMvc
            .perform(get("/api/projects/" + projectId + "/export?format=json").session(session))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "application/json"))
            .andReturn();

    JsonNode rows = objectMapper.readTree(result.getResponse().getContentAsString());
    assertThat(rows.isArray()).isTrue();
    assertThat(rows.size()).isEqualTo(1);
    assertThat(rows.get(0).get("description").asText()).isEqualTo("Plan sprint");
    assertThat(rows.get(0).get("durationSeconds").asLong()).isEqualTo(1800);
  }

  @Test
  void exportIncludesTasksFromSubprojects() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long parentId = createProject(session, "Parent " + UUID.randomUUID());
    MvcResult childResult =
        mockMvc
            .perform(
                post("/api/projects")
                    .with(csrf())
                    .session(session)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Child", "parentId", parentId))))
            .andExpect(status().isCreated())
            .andReturn();
    long childId =
        objectMapper.readTree(childResult.getResponse().getContentAsString()).get("id").asLong();

    Instant now = Instant.now();
    createTask(
        session,
        "Parent task",
        now.minus(3, ChronoUnit.HOURS),
        now.minus(2, ChronoUnit.HOURS),
        parentId);
    createTask(session, "Child task", now.minus(1, ChronoUnit.HOURS), now, childId);

    MvcResult result =
        mockMvc
            .perform(get("/api/projects/" + parentId + "/export?format=json").session(session))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode rows = objectMapper.readTree(result.getResponse().getContentAsString());
    assertThat(rows.size()).isEqualTo(2);
  }

  @Test
  void exportFiltersByFromAndTo() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long projectId = createProject(session, "Filtered Export " + UUID.randomUUID());
    Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    Instant monthStart = now.minus(30, ChronoUnit.DAYS);

    createTask(
        session,
        "Old task",
        now.minus(60, ChronoUnit.DAYS),
        now.minus(59, ChronoUnit.DAYS),
        projectId);
    createTask(session, "Recent task", now.minus(1, ChronoUnit.DAYS), now, projectId);

    MvcResult result =
        mockMvc
            .perform(
                get("/api/projects/" + projectId + "/export?format=json")
                    .session(session)
                    .param("from", monthStart.toString()))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode rows = objectMapper.readTree(result.getResponse().getContentAsString());
    assertThat(rows.size()).isEqualTo(1);
    assertThat(rows.get(0).get("description").asText()).isEqualTo("Recent task");
  }

  @Test
  void exportRejectsNonOwner() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession otherSession = registerAndGetSession(uniqueEmail());
    long projectId = createProject(ownerSession, "Private " + UUID.randomUUID());

    mockMvc
        .perform(get("/api/projects/" + projectId + "/export").session(otherSession))
        .andExpect(status().isNotFound());
  }

  @Test
  void exportIncludesUserEmailInEachRow() throws Exception {
    String email = uniqueEmail();
    MockHttpSession session = registerAndGetSession(email);
    long projectId = createProject(session, "User Email Export " + UUID.randomUUID());
    Instant start = Instant.now().minus(1, ChronoUnit.HOURS);
    createTask(session, "task", start, start.plus(30, ChronoUnit.MINUTES), projectId);

    MvcResult result =
        mockMvc
            .perform(get("/api/projects/" + projectId + "/export?format=json").session(session))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode rows = objectMapper.readTree(result.getResponse().getContentAsString());
    assertThat(rows.get(0).get("user").asText()).isEqualTo(email);
  }

  @Test
  void csvExportQuotesDescriptionsContainingCommas() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long projectId = createProject(session, "Comma CSV " + UUID.randomUUID());
    Instant start = Instant.now().minus(1, ChronoUnit.HOURS);
    createTask(session, "plan, review, ship", start, start.plus(30, ChronoUnit.MINUTES), projectId);

    MvcResult result =
        mockMvc
            .perform(get("/api/projects/" + projectId + "/export").session(session))
            .andExpect(status().isOk())
            .andReturn();

    assertThat(result.getResponse().getContentAsString()).contains("\"plan, review, ship\"");
  }
}
