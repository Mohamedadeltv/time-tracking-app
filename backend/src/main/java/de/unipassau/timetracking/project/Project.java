package de.unipassau.timetracking.project;

import de.unipassau.timetracking.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "project")
public class Project {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false)
  @JoinColumn(name = "owner_id", nullable = false)
  private AppUser owner;

  @Column(nullable = false)
  private String name;

  protected Project() {}

  public Project(AppUser owner, String name) {
    this.owner = owner;
    this.name = name;
  }

  public Long getId() {
    return id;
  }

  public AppUser getOwner() {
    return owner;
  }

  public String getName() {
    return name;
  }

  public void rename(String name) {
    this.name = name;
  }
}
