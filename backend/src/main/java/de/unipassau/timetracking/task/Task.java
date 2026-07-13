package de.unipassau.timetracking.task;

import de.unipassau.timetracking.project.Project;
import de.unipassau.timetracking.user.AppUser;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "task")
public class Task {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false)
  @JoinColumn(name = "owner_id", nullable = false)
  private AppUser owner;

  @Column private String description;

  @Column(nullable = false)
  private Instant startTime;

  @Column private Instant endTime;

  @ManyToMany
  @JoinTable(
      name = "task_project",
      joinColumns = @JoinColumn(name = "task_id"),
      inverseJoinColumns = @JoinColumn(name = "project_id"))
  private Set<Project> projects = new HashSet<>();

  @ElementCollection
  @CollectionTable(name = "task_tag", joinColumns = @JoinColumn(name = "task_id"))
  @Column(name = "tag")
  private Set<String> tags = new HashSet<>();

  protected Task() {}

  public Task(AppUser owner, String description, Instant startTime) {
    this.owner = owner;
    this.description = description;
    this.startTime = startTime;
  }

  public Long getId() {
    return id;
  }

  public AppUser getOwner() {
    return owner;
  }

  public String getDescription() {
    return description;
  }

  public Instant getStartTime() {
    return startTime;
  }

  public Instant getEndTime() {
    return endTime;
  }

  public boolean isRunning() {
    return endTime == null;
  }

  public void stop(Instant endTime) {
    this.endTime = endTime;
  }

  public void update(String description, Instant startTime, Instant endTime) {
    this.description = description;
    this.startTime = startTime;
    this.endTime = endTime;
  }

  public Set<Project> getProjects() {
    return projects;
  }

  public void setProjects(Set<Project> projects) {
    this.projects = projects;
  }

  public Set<String> getTags() {
    return tags;
  }

  public void setTags(Set<String> tags) {
    this.tags = tags;
  }
}
