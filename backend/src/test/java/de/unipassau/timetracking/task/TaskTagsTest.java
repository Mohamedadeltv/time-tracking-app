package de.unipassau.timetracking.task;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
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
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class TaskTagsTest {

  @Autowired private org.springframework.test.web.servlet.MockMvc mockMvc;
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

  private long createTaskWithTags(
      MockHttpSession session, String description, Instant start, Instant end, List<String> tags)
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
                                "tags",
                                tags))))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
  }

  @Test
  void createStoresNormalizedTags() throws Exception {
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
                            "description", "Tagged task",
                            "startTime", start.toString(),
                            "endTime", end.toString(),
                            "tags", List.of(" Work ", "URGENT", "work")))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.tags.length()").value(2))
        .andExpect(jsonPath("$.tags[0]").value("urgent"))
        .andExpect(jsonPath("$.tags[1]").value("work"));
  }

  @Test
  void createWithoutTagsReturnsEmptyTagList() throws Exception {
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
                            "description", "Untagged task",
                            "startTime", start.toString(),
                            "endTime", end.toString()))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.tags.length()").value(0));
  }

  @Test
  void createRejectsATagLongerThanFiftyCharacters() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    String tooLong = "a".repeat(51);

    mockMvc
        .perform(
            post("/api/tasks")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(
                        Map.of(
                            "description", "Task",
                            "startTime", start.toString(),
                            "endTime", end.toString(),
                            "tags", List.of(tooLong)))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void updateReplacesTheTagSet() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    long id = createTaskWithTags(session, "Task", start, end, List.of("old"));

    mockMvc
        .perform(
            put("/api/tasks/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(
                        Map.of(
                            "description", "Task",
                            "startTime", start.toString(),
                            "endTime", end.toString(),
                            "tags", List.of("new")))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tags.length()").value(1))
        .andExpect(jsonPath("$.tags[0]").value("new"));
  }

  @Test
  void listFiltersByTagCaseInsensitively() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    createTaskWithTags(
        session,
        "Work task",
        now.minus(2, ChronoUnit.HOURS),
        now.minus(1, ChronoUnit.HOURS),
        List.of("work"));
    createTaskWithTags(
        session,
        "Personal task",
        now.minus(4, ChronoUnit.HOURS),
        now.minus(3, ChronoUnit.HOURS),
        List.of("personal"));

    mockMvc
        .perform(get("/api/tasks").session(session).param("tag", "WORK"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].description").value("Work task"));
  }

  @Test
  void listWithoutTagParamReturnsAllTasks() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    createTaskWithTags(
        session,
        "Work task",
        now.minus(2, ChronoUnit.HOURS),
        now.minus(1, ChronoUnit.HOURS),
        List.of("work"));
    createTaskWithTags(
        session,
        "Personal task",
        now.minus(4, ChronoUnit.HOURS),
        now.minus(3, ChronoUnit.HOURS),
        List.of("personal"));

    mockMvc
        .perform(get("/api/tasks").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
  }

  @Test
  void listWithUnmatchedTagReturnsEmptyList() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    createTaskWithTags(
        session,
        "Work task",
        now.minus(2, ChronoUnit.HOURS),
        now.minus(1, ChronoUnit.HOURS),
        List.of("work"));

    mockMvc
        .perform(get("/api/tasks").session(session).param("tag", "nonexistent"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }
}
