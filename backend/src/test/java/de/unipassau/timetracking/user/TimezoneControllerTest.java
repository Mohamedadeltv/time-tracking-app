package de.unipassau.timetracking.user;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
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
class TimezoneControllerTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static String uniqueEmail() {
    return "tz-" + UUID.randomUUID() + "@example.com";
  }

  private MockHttpSession registerAndGetSession(String email) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/auth/register")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            Map.of("email", email, "password", "password123"))))
            .andReturn();
    return (MockHttpSession) result.getRequest().getSession(false);
  }

  @Test
  void setTimezoneReturnsUpdatedUser() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            put("/api/auth/timezone")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", "Europe/Berlin"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timezone").value("Europe/Berlin"));
  }

  @Test
  void setTimezoneIsPersisted() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc.perform(
        put("/api/auth/timezone")
            .with(csrf())
            .session(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("timezone", "America/New_York"))));

    mockMvc
        .perform(get("/api/auth/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timezone").value("America/New_York"));
  }

  @Test
  void newUsersHaveNullTimezone() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(get("/api/auth/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timezone").doesNotExist());
  }

  @Test
  void setTimezoneRejectsInvalidZone() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            put("/api/auth/timezone")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", "Not/AZone"))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void setTimezoneRejectsEmptyString() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            put("/api/auth/timezone")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", ""))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void setTimezoneRequiresAuthentication() throws Exception {
    mockMvc
        .perform(
            put("/api/auth/timezone")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", "UTC"))))
        .andExpect(status().isUnauthorized());
  }
}
