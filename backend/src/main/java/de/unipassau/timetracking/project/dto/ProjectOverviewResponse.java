package de.unipassau.timetracking.project.dto;

import de.unipassau.timetracking.task.dto.TaskResponse;
import java.util.List;

/**
 * The tasks of a project and all its descendant subprojects, optionally scoped to a time window,
 * together with the rolled-up total over that same set.
 */
public record ProjectOverviewResponse(
    Long projectId, String projectName, long totalSeconds, List<TaskResponse> tasks) {}
