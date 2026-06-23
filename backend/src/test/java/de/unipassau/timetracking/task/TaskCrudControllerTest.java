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
class TaskCrudControllerTest {

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

  private long createTask(MockHttpSession session, String description, Instant start, Instant end)
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
                                "description", description,
                                "startTime", start.toString(),
                                "endTime", end.toString()))))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
  }

  @Test
  void createAddsACompletedTaskWithExplicitTimes() throws Exception {
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
                            "description", "Backfilled task",
                            "startTime", start.toString(),
                            "endTime", end.toString()))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.description").value("Backfilled task"))
        .andExpect(jsonPath("$.running").value(false));
  }

  @Test
  void createRejectsEndTimeBeforeStartTime() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant start = Instant.now();
    Instant end = start.minus(1, ChronoUnit.HOURS);

    mockMvc
        .perform(
            post("/api/tasks")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("startTime", start.toString(), "endTime", end.toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createRejectsEndTimeEqualToStartTime() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant instant = Instant.now();

    mockMvc
        .perform(
            post("/api/tasks")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(Map.of("startTime", instant.toString(), "endTime", instant.toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createRejectsMissingTimes() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            post("/api/tasks")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("description", "No times"))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void listReturnsOnlyTheCurrentUsersTasksNewestFirst() throws Exception {
    MockHttpSession sessionA = registerAndGetSession(uniqueEmail());
    MockHttpSession sessionB = registerAndGetSession(uniqueEmail());
    Instant now = Instant.now();
    createTask(sessionA, "Older", now.minus(3, ChronoUnit.HOURS), now.minus(2, ChronoUnit.HOURS));
    createTask(sessionA, "Newer", now.minus(1, ChronoUnit.HOURS), now);
    createTask(sessionB, "Someone else's task", now.minus(1, ChronoUnit.HOURS), now);

    mockMvc
        .perform(get("/api/tasks").session(sessionA))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].description").value("Newer"))
        .andExpect(jsonPath("$[1].description").value("Older"));
  }

  @Test
  void updateChangesDescriptionAndTimes() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    long id = createTask(session, "Original", start, end);

    Instant newStart = start.minus(30, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.MILLIS);
    mockMvc
        .perform(
            put("/api/tasks/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(
                        Map.of(
                            "description", "Corrected",
                            "startTime", newStart.toString(),
                            "endTime", end.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.description").value("Corrected"))
        .andExpect(jsonPath("$.startTime").value(newStart.toString()));
  }

  @Test
  void updateCanMoveTheStartTimeOfARunningTaskWithoutStoppingIt() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    MvcResult startResult =
        mockMvc.perform(post("/api/tasks/start").with(csrf()).session(session)).andReturn();
    long id =
        objectMapper.readTree(startResult.getResponse().getContentAsString()).get("id").asLong();
    Instant correctedStart =
        Instant.now().minus(15, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.MILLIS);

    mockMvc
        .perform(
            put("/api/tasks/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("startTime", correctedStart.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.running").value(true))
        .andExpect(jsonPath("$.startTime").value(correctedStart.toString()));
  }

  @Test
  void updateCanCompleteARunningTaskByProvidingAnEndTime() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    MvcResult startResult =
        mockMvc.perform(post("/api/tasks/start").with(csrf()).session(session)).andReturn();
    long id =
        objectMapper.readTree(startResult.getResponse().getContentAsString()).get("id").asLong();
    String startTime =
        objectMapper
            .readTree(startResult.getResponse().getContentAsString())
            .get("startTime")
            .asText();

    mockMvc
        .perform(
            put("/api/tasks/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(Map.of("startTime", startTime, "endTime", Instant.now().toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.running").value(false));
  }

  @Test
  void updateRejectsReopeningACompletedTask() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    long id = createTask(session, "Completed", start, end);

    mockMvc
        .perform(
            put("/api/tasks/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("startTime", start.toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void updateRejectsEndTimeBeforeStartTime() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    long id = createTask(session, "Completed", start, end);

    mockMvc
        .perform(
            put("/api/tasks/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(
                        Map.of(
                            "startTime", end.toString(),
                            "endTime", start.toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void updateReturnsNotFoundForATaskBelongingToAnotherUser() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession otherSession = registerAndGetSession(uniqueEmail());
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    long id = createTask(ownerSession, "Mine", start, end);

    mockMvc
        .perform(
            put("/api/tasks/" + id)
                .with(csrf())
                .session(otherSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("startTime", start.toString(), "endTime", end.toString()))))
        .andExpect(status().isNotFound());
  }

  @Test
  void updateReturnsNotFoundForANonexistentTask() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            put("/api/tasks/999999")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("startTime", Instant.now().toString()))))
        .andExpect(status().isNotFound());
  }

  @Test
  void deleteRemovesTheTask() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    long id = createTask(session, "To delete", start, end);

    mockMvc
        .perform(delete("/api/tasks/" + id).with(csrf()).session(session))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/tasks").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void deleteReturnsNotFoundForATaskBelongingToAnotherUser() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession otherSession = registerAndGetSession(uniqueEmail());
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    long id = createTask(ownerSession, "Mine", start, end);

    mockMvc
        .perform(delete("/api/tasks/" + id).with(csrf()).session(otherSession))
        .andExpect(status().isNotFound());
  }

  @Test
  void crudEndpointsRejectUnauthenticatedRequests() throws Exception {
    mockMvc.perform(post("/api/tasks").with(csrf())).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/tasks")).andExpect(status().isUnauthorized());
    mockMvc.perform(put("/api/tasks/1").with(csrf())).andExpect(status().isUnauthorized());
    mockMvc.perform(delete("/api/tasks/1").with(csrf())).andExpect(status().isUnauthorized());
  }
}
