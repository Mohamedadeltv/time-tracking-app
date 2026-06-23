package de.unipassau.timetracking.project;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
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
class ProjectControllerTest {

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

  @Test
  void createAddsAProject() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Lecture"))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Lecture"));
  }

  @Test
  void createRejectsBlankName() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "  "))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createRejectsDuplicateNameForTheSameUser() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    createProject(session, "Lecture");

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "lecture"))))
        .andExpect(status().isConflict());
  }

  @Test
  void createAllowsTheSameNameForDifferentUsers() throws Exception {
    MockHttpSession sessionA = registerAndGetSession(uniqueEmail());
    MockHttpSession sessionB = registerAndGetSession(uniqueEmail());
    createProject(sessionA, "Lecture");

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(sessionB)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Lecture"))))
        .andExpect(status().isCreated());
  }

  @Test
  void listReturnsOnlyTheCurrentUsersProjectsSortedByName() throws Exception {
    MockHttpSession sessionA = registerAndGetSession(uniqueEmail());
    MockHttpSession sessionB = registerAndGetSession(uniqueEmail());
    createProject(sessionA, "Beta");
    createProject(sessionA, "Alpha");
    createProject(sessionB, "Someone else's project");

    mockMvc
        .perform(get("/api/projects").session(sessionA))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].name").value("Alpha"))
        .andExpect(jsonPath("$[1].name").value("Beta"));
  }

  @Test
  void updateRenamesAProject() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long id = createProject(session, "Old name");

    mockMvc
        .perform(
            put("/api/projects/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "New name"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("New name"));
  }

  @Test
  void updateAllowsKeepingTheCurrentName() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long id = createProject(session, "Lecture");

    mockMvc
        .perform(
            put("/api/projects/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Lecture"))))
        .andExpect(status().isOk());
  }

  @Test
  void updateRejectsRenamingToAnAlreadyUsedName() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    createProject(session, "Lecture");
    long id = createProject(session, "Seminar");

    mockMvc
        .perform(
            put("/api/projects/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Lecture"))))
        .andExpect(status().isConflict());
  }

  @Test
  void updateReturnsNotFoundForAnotherUsersProject() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession otherSession = registerAndGetSession(uniqueEmail());
    long id = createProject(ownerSession, "Lecture");

    mockMvc
        .perform(
            put("/api/projects/" + id)
                .with(csrf())
                .session(otherSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Hijacked"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void updateReturnsNotFoundForANonexistentProject() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            put("/api/projects/999999")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Anything"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void deleteRemovesAProject() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    long id = createProject(session, "To delete");

    mockMvc
        .perform(delete("/api/projects/" + id).with(csrf()).session(session))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/projects").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void deleteReturnsNotFoundForAnotherUsersProject() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession otherSession = registerAndGetSession(uniqueEmail());
    long id = createProject(ownerSession, "Lecture");

    mockMvc
        .perform(delete("/api/projects/" + id).with(csrf()).session(otherSession))
        .andExpect(status().isNotFound());
  }

  @Test
  void projectEndpointsRejectUnauthenticatedRequests() throws Exception {
    mockMvc.perform(post("/api/projects").with(csrf())).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());
    mockMvc.perform(put("/api/projects/1").with(csrf())).andExpect(status().isUnauthorized());
    mockMvc.perform(delete("/api/projects/1").with(csrf())).andExpect(status().isUnauthorized());
  }
}
