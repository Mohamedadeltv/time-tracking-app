package de.unipassau.timetracking.security;

import de.unipassau.timetracking.user.AppUser;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class AppUserPrincipal implements UserDetails {

  private final AppUser appUser;

  public AppUserPrincipal(AppUser appUser) {
    this.appUser = appUser;
  }

  public Long getId() {
    return appUser.getId();
  }

  public String getEmail() {
    return appUser.getEmail();
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return List.of();
  }

  @Override
  public String getPassword() {
    return appUser.getPasswordHash();
  }

  @Override
  public String getUsername() {
    return appUser.getEmail();
  }
}
