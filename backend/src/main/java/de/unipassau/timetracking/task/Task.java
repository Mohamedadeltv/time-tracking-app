package de.unipassau.timetracking.task;

import de.unipassau.timetracking.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

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
}
