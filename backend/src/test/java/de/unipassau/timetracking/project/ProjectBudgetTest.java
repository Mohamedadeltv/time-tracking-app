package de.unipassau.timetracking.project;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
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
class ProjectBudgetTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static String uniqueEmail() {
    return "budget-" + UUID.randomUUID() + "@example.com";
  }

  private MockHttpSession registerAndGetSession() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/auth/register")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            Map.of("email", uniqueEmail(), "password", "password123"))))
            .andReturn();
    return (MockHttpSession) result.getRequest().getSession(false);
  }

  @Test
  void createProjectWithBudgetStoresBudgetHours() throws Exception {
    MockHttpSession session = registerAndGetSession();

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of("name", "Budgeted " + UUID.randomUUID(), "budgetHours", 10))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.budgetHours").value(10));
  }

  @Test
  void createProjectWithoutBudgetHasNullBudgetHours() throws Exception {
    MockHttpSession session = registerAndGetSession();

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of("name", "No budget " + UUID.randomUUID()))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.budgetHours").doesNotExist());
  }

  @Test
  void updateProjectCanSetBudgetHours() throws Exception {
    MockHttpSession session = registerAndGetSession();
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/projects")
                    .with(csrf())
                    .session(session)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            Map.of("name", "Update Budget " + UUID.randomUUID()))))
            .andReturn();
    long id =
        objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asLong();

    mockMvc
        .perform(
            put("/api/projects/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of("name", "Update Budget", "budgetHours", 20))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.budgetHours").value(20));
  }

  @Test
  void updateProjectCanClearBudgetHours() throws Exception {
    MockHttpSession session = registerAndGetSession();
    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/projects")
                    .with(csrf())
                    .session(session)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            Map.of("name", "Clear Budget " + UUID.randomUUID(), "budgetHours", 5))))
            .andReturn();
    long id =
        objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asLong();

    mockMvc
        .perform(
            put("/api/projects/" + id)
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "Clear Budget"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.budgetHours").doesNotExist());
  }

  @Test
  void createProjectRejectsZeroBudgetHours() throws Exception {
    MockHttpSession session = registerAndGetSession();

    mockMvc
        .perform(
            post("/api/projects")
                .with(csrf())
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsString(
                        Map.of("name", "Zero Budget", "budgetHours", 0))))
        .andExpect(status().isBadRequest());
  }
}
