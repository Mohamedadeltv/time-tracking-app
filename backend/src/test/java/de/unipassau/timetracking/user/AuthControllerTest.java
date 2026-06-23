package de.unipassau.timetracking.user;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class AuthControllerTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static String uniqueEmail() {
    return "user-" + UUID.randomUUID() + "@example.com";
  }

  private MvcResult register(String email, String password) throws Exception {
    return mockMvc
        .perform(
            post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", email, "password", password))))
        .andReturn();
  }

  private MockHttpSession registerAndGetSession(String email, String password) throws Exception {
    MvcResult result = register(email, password);
    return (MockHttpSession) result.getRequest().getSession(false);
  }

  private String toJson(Map<String, String> body) throws Exception {
    return objectMapper.writeValueAsString(body);
  }

  @Test
  void registerCreatesUserAndAutoLogsIn() throws Exception {
    String email = uniqueEmail();
    MockHttpSession session = registerAndGetSession(email, "password123");

    mockMvc
        .perform(get("/api/auth/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(email));
  }

  @Test
  void registerRejectsDuplicateEmail() throws Exception {
    String email = uniqueEmail();
    register(email, "password123").getResponse();

    mockMvc
        .perform(
            post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", email, "password", "anotherPassword1"))))
        .andExpect(status().isConflict());
  }

  @Test
  void registerRejectsInvalidInput() throws Exception {
    mockMvc
        .perform(
            post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", "not-an-email", "password", "short"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors.email").exists())
        .andExpect(jsonPath("$.errors.password").exists());
  }

  @Test
  void loginSucceedsWithCorrectCredentials() throws Exception {
    String email = uniqueEmail();
    String password = "password123";
    mockMvc
        .perform(
            post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", email, "password", password))))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", email, "password", password))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(email));
  }

  @Test
  void loginRejectsWrongPassword() throws Exception {
    String email = uniqueEmail();
    registerAndGetSession(email, "password123");

    mockMvc
        .perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", email, "password", "wrongPassword"))))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void loginRejectsUnknownEmail() throws Exception {
    mockMvc
        .perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", uniqueEmail(), "password", "whatever123"))))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void meRejectsUnauthenticatedRequest() throws Exception {
    mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void changePasswordSucceedsAndNewPasswordWorks() throws Exception {
    String email = uniqueEmail();
    String oldPassword = "password123";
    String newPassword = "newPassword456";
    MockHttpSession session = registerAndGetSession(email, oldPassword);

    mockMvc
        .perform(
            post("/api/auth/change-password")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(Map.of("currentPassword", oldPassword, "newPassword", newPassword))))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("email", email, "password", newPassword))))
        .andExpect(status().isOk());
  }

  @Test
  void changePasswordRejectsWrongCurrentPassword() throws Exception {
    String email = uniqueEmail();
    MockHttpSession session = registerAndGetSession(email, "password123");

    mockMvc
        .perform(
            post("/api/auth/change-password")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    toJson(
                        Map.of(
                            "currentPassword", "wrongPassword",
                            "newPassword", "newPassword456"))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void logoutInvalidatesSessionSoMeIsRejectedAfterwards() throws Exception {
    String email = uniqueEmail();
    MockHttpSession session = registerAndGetSession(email, "password123");

    mockMvc
        .perform(post("/api/auth/logout").with(csrf()).session(session))
        .andExpect(status().isNoContent());

    mockMvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
  }
}
