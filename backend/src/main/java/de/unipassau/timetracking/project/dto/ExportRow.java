package de.unipassau.timetracking.project.dto;

import java.util.List;

public record ExportRow(
    String startTime,
    String endTime,
    long durationSeconds,
    String description,
    List<String> projects,
    String user) {}
