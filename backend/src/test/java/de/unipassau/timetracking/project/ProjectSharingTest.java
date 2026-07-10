package de.unipassau.timetracking.project;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class ProjectSharingTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static String uniqueEmail() {
    return "share-" + UUID.randomUUID() + "@example.com";
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

  private long createTask(MockHttpSession session, Instant start, Instant end, long projectId)
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
                                "task",
                                "startTime",
                                start.toString(),
                                "endTime",
                                end.toString(),
                                "projectIds",
                                new long[] {projectId}))))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
  }

  private String toJson(Object body) throws Exception {
    return objectMapper.writeValueAsString(body);
  }

  @Test
  void ownerCanInviteAnotherUser() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String inviteeEmail = uniqueEmail();
    registerAndGetSession(inviteeEmail);
    long projectId = createProject(ownerSession, "Shared Project " + UUID.randomUUID());

    mockMvc
        .perform(
            post("/api/projects/" + projectId + "/members")
                .with(csrf())
                .session(ownerSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", inviteeEmail))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.email").value(inviteeEmail))
        .andExpect(jsonPath("$.role").value("MEMBER"));
  }

  @Test
  void ownerCanListMembers() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String inviteeEmail = uniqueEmail();
    registerAndGetSession(inviteeEmail);
    long projectId = createProject(ownerSession, "Members List " + UUID.randomUUID());
    mockMvc.perform(
        post("/api/projects/" + projectId + "/members")
            .with(csrf())
            .session(ownerSession)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", inviteeEmail))));

    mockMvc
        .perform(get("/api/projects/" + projectId + "/members").session(ownerSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
  }

  @Test
  void invitedUserSeesSharedProjectInTheirList() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String inviteeEmail = uniqueEmail();
    MockHttpSession inviteeSession = registerAndGetSession(inviteeEmail);
    long projectId = createProject(ownerSession, "Visible To Invitee " + UUID.randomUUID());

    mockMvc.perform(
        post("/api/projects/" + projectId + "/members")
            .with(csrf())
            .session(ownerSession)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", inviteeEmail))));

    mockMvc
        .perform(get("/api/projects").session(inviteeSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.id == " + projectId + ")]").exists());
  }

  @Test
  void invitedUserCanAssignTasksToSharedProject() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String inviteeEmail = uniqueEmail();
    MockHttpSession inviteeSession = registerAndGetSession(inviteeEmail);
    long projectId = createProject(ownerSession, "Task Target " + UUID.randomUUID());

    mockMvc.perform(
        post("/api/projects/" + projectId + "/members")
            .with(csrf())
            .session(ownerSession)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", inviteeEmail))));

    Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
    Instant end = Instant.now().minus(1, ChronoUnit.HOURS);
    createTask(inviteeSession, start, end, projectId);
  }

  @Test
  void overviewIncludesAllMembersTasksAndSumsTheirTime() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String inviteeEmail = uniqueEmail();
    MockHttpSession inviteeSession = registerAndGetSession(inviteeEmail);
    long projectId = createProject(ownerSession, "Cross User " + UUID.randomUUID());

    mockMvc.perform(
        post("/api/projects/" + projectId + "/members")
            .with(csrf())
            .session(ownerSession)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", inviteeEmail))));

    Instant now = Instant.now();
    createTask(
        ownerSession, now.minus(3, ChronoUnit.HOURS), now.minus(2, ChronoUnit.HOURS), projectId);
    createTask(inviteeSession, now.minus(1, ChronoUnit.HOURS), now, projectId);

    mockMvc
        .perform(get("/api/projects/" + projectId + "/overview").session(ownerSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tasks.length()").value(2))
        .andExpect(jsonPath("$.totalSeconds").value(7200));
  }

  @Test
  void overviewCanBeFilteredByUser() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String inviteeEmail = uniqueEmail();
    MockHttpSession inviteeSession = registerAndGetSession(inviteeEmail);
    long projectId = createProject(ownerSession, "Filtered Overview " + UUID.randomUUID());

    mockMvc.perform(
        post("/api/projects/" + projectId + "/members")
            .with(csrf())
            .session(ownerSession)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", inviteeEmail))));

    Instant now = Instant.now();
    createTask(
        ownerSession, now.minus(3, ChronoUnit.HOURS), now.minus(2, ChronoUnit.HOURS), projectId);
    createTask(inviteeSession, now.minus(1, ChronoUnit.HOURS), now, projectId);

    MvcResult meResult = mockMvc.perform(get("/api/auth/me").session(inviteeSession)).andReturn();
    long inviteeUserId =
        objectMapper.readTree(meResult.getResponse().getContentAsString()).get("id").asLong();

    mockMvc
        .perform(
            get("/api/projects/" + projectId + "/overview")
                .session(ownerSession)
                .param("userId", String.valueOf(inviteeUserId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tasks.length()").value(1));
  }

  @Test
  void ownerCanRemoveAMember() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String inviteeEmail = uniqueEmail();
    MockHttpSession inviteeSession = registerAndGetSession(inviteeEmail);
    long projectId = createProject(ownerSession, "Remove Member " + UUID.randomUUID());

    MvcResult inviteResult =
        mockMvc
            .perform(
                post("/api/projects/" + projectId + "/members")
                    .with(csrf())
                    .session(ownerSession)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("email", inviteeEmail))))
            .andReturn();
    long inviteeUserId =
        objectMapper
            .readTree(inviteResult.getResponse().getContentAsString())
            .get("userId")
            .asLong();

    mockMvc
        .perform(
            delete("/api/projects/" + projectId + "/members/" + inviteeUserId)
                .with(csrf())
                .session(ownerSession))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/projects").session(inviteeSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.id == " + projectId + ")]").doesNotExist());
  }

  @Test
  void duplicateInviteReturnsConflict() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String inviteeEmail = uniqueEmail();
    registerAndGetSession(inviteeEmail);
    long projectId = createProject(ownerSession, "Dup Invite " + UUID.randomUUID());

    mockMvc.perform(
        post("/api/projects/" + projectId + "/members")
            .with(csrf())
            .session(ownerSession)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", inviteeEmail))));

    mockMvc
        .perform(
            post("/api/projects/" + projectId + "/members")
                .with(csrf())
                .session(ownerSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", inviteeEmail))))
        .andExpect(status().isConflict());
  }

  @Test
  void invitingNonExistentEmailReturnsNotFound() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    long projectId = createProject(ownerSession, "Ghost Invite " + UUID.randomUUID());

    mockMvc
        .perform(
            post("/api/projects/" + projectId + "/members")
                .with(csrf())
                .session(ownerSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", "nobody@nowhere.com"))))
        .andExpect(status().isNotFound());
  }

  @Test
  void nonMemberCannotAccessProject() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession strangerSession = registerAndGetSession(uniqueEmail());
    long projectId = createProject(ownerSession, "Private " + UUID.randomUUID());

    mockMvc
        .perform(get("/api/projects/" + projectId + "/overview").session(strangerSession))
        .andExpect(status().isNotFound());
  }

  @Test
  void nonMemberCannotInviteOthers() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    MockHttpSession strangerSession = registerAndGetSession(uniqueEmail());
    String thirdEmail = uniqueEmail();
    registerAndGetSession(thirdEmail);
    long projectId = createProject(ownerSession, "Stranger Invite " + UUID.randomUUID());

    mockMvc
        .perform(
            post("/api/projects/" + projectId + "/members")
                .with(csrf())
                .session(strangerSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", thirdEmail))))
        .andExpect(status().isNotFound());
  }

  @Test
  void memberCannotInviteOthers() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String memberEmail = uniqueEmail();
    MockHttpSession memberSession = registerAndGetSession(memberEmail);
    String thirdEmail = uniqueEmail();
    registerAndGetSession(thirdEmail);
    long projectId = createProject(ownerSession, "Member Cannot Invite " + UUID.randomUUID());

    mockMvc.perform(
        post("/api/projects/" + projectId + "/members")
            .with(csrf())
            .session(ownerSession)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", memberEmail))));

    mockMvc
        .perform(
            post("/api/projects/" + projectId + "/members")
                .with(csrf())
                .session(memberSession)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", thirdEmail))))
        .andExpect(status().isNotFound());
  }

  @Test
  void deletingProjectAlsoRemovesMemberships() throws Exception {
    MockHttpSession ownerSession = registerAndGetSession(uniqueEmail());
    String inviteeEmail = uniqueEmail();
    MockHttpSession inviteeSession = registerAndGetSession(inviteeEmail);
    long projectId = createProject(ownerSession, "To Delete " + UUID.randomUUID());

    mockMvc.perform(
        post("/api/projects/" + projectId + "/members")
            .with(csrf())
            .session(ownerSession)
            .contentType(MediaType.APPLICATION_JSON)
            .content(toJson(Map.of("email", inviteeEmail))));

    mockMvc.perform(delete("/api/projects/" + projectId).with(csrf()).session(ownerSession));

    mockMvc
        .perform(get("/api/projects").session(inviteeSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.id == " + projectId + ")]").doesNotExist());
  }
}
