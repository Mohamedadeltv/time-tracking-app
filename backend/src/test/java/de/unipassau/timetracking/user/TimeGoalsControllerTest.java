package de.unipassau.timetracking.user;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
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
class TimeGoalsControllerTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static String uniqueEmail() {
    return "goals-" + UUID.randomUUID() + "@example.com";
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

  private Map<String, Object> goals(Long daily, Long weekly) {
    Map<String, Object> body = new HashMap<>();
    body.put("dailyGoalHours", daily);
    body.put("weeklyGoalHours", weekly);
    return body;
  }

  @Test
  void setGoalsReturnsUpdatedUser() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            put("/api/auth/goals")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(goals(4L, 20L))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dailyGoalHours").value(4))
        .andExpect(jsonPath("$.weeklyGoalHours").value(20));
  }

  @Test
  void setGoalsIsPersisted() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc.perform(
        put("/api/auth/goals")
            .with(csrf())
            .session(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(goals(6L, 30L))));

    mockMvc
        .perform(get("/api/auth/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dailyGoalHours").value(6))
        .andExpect(jsonPath("$.weeklyGoalHours").value(30));
  }

  @Test
  void setGoalsAllowsSettingOnlyOne() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            put("/api/auth/goals")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(goals(8L, null))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dailyGoalHours").value(8))
        .andExpect(jsonPath("$.weeklyGoalHours").doesNotExist());
  }

  @Test
  void setGoalsCanClearAPreviouslySetGoal() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());
    mockMvc.perform(
        put("/api/auth/goals")
            .with(csrf())
            .session(session)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(goals(4L, 20L))));

    mockMvc
        .perform(
            put("/api/auth/goals")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(goals(null, null))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dailyGoalHours").doesNotExist())
        .andExpect(jsonPath("$.weeklyGoalHours").doesNotExist());
  }

  @Test
  void newUsersHaveNullGoals() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(get("/api/auth/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dailyGoalHours").doesNotExist())
        .andExpect(jsonPath("$.weeklyGoalHours").doesNotExist());
  }

  @Test
  void setGoalsRejectsZeroDailyGoal() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            put("/api/auth/goals")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(goals(0L, 20L))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void setGoalsRejectsNegativeWeeklyGoal() throws Exception {
    MockHttpSession session = registerAndGetSession(uniqueEmail());

    mockMvc
        .perform(
            put("/api/auth/goals")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(goals(4L, -5L))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void setGoalsRequiresAuthentication() throws Exception {
    mockMvc
        .perform(
            put("/api/auth/goals")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(goals(4L, 20L))))
        .andExpect(status().isUnauthorized());
  }
}
