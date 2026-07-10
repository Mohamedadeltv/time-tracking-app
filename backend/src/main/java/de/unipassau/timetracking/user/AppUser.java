package de.unipassau.timetracking.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "app_user")
public class AppUser {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true)
  private String email;

  @Column(nullable = false)
  private String passwordHash;

  @Column(nullable = false)
  private Instant createdAt;

  @Column private String preferredTimezone;

  protected AppUser() {}

  public AppUser(String email, String passwordHash) {
    this.email = email;
    this.passwordHash = passwordHash;
    this.createdAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public String getEmail() {
    return email;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public void setPasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public String getPreferredTimezone() {
    return preferredTimezone;
  }

  public void setPreferredTimezone(String timezone) {
    this.preferredTimezone = timezone;
  }
}
