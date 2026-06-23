package de.unipassau.timetracking.user;

import de.unipassau.timetracking.security.AppUserPrincipal;
import de.unipassau.timetracking.user.dto.ChangePasswordRequest;
import de.unipassau.timetracking.user.dto.LoginRequest;
import de.unipassau.timetracking.user.dto.RegisterRequest;
import de.unipassau.timetracking.user.dto.UserResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AppUserRepository appUserRepository;
  private final PasswordEncoder passwordEncoder;
  private final AuthenticationManager authenticationManager;
  private final SecurityContextRepository securityContextRepository;

  public AuthController(
      AppUserRepository appUserRepository,
      PasswordEncoder passwordEncoder,
      AuthenticationManager authenticationManager,
      SecurityContextRepository securityContextRepository) {
    this.appUserRepository = appUserRepository;
    this.passwordEncoder = passwordEncoder;
    this.authenticationManager = authenticationManager;
    this.securityContextRepository = securityContextRepository;
  }

  @PostMapping("/register")
  public ResponseEntity<UserResponse> register(
      @Valid @RequestBody RegisterRequest request,
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    if (appUserRepository.existsByEmail(request.email())) {
      throw new EmailAlreadyInUseException(request.email());
    }
    AppUser user = new AppUser(request.email(), passwordEncoder.encode(request.password()));
    appUserRepository.save(user);

    AppUserPrincipal principal = new AppUserPrincipal(user);
    Authentication authentication =
        new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    persistAuthentication(authentication, httpRequest, httpResponse);

    return ResponseEntity.status(201).body(UserResponse.from(user));
  }

  @PostMapping("/login")
  public ResponseEntity<UserResponse> login(
      @Valid @RequestBody LoginRequest request,
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    Authentication authentication =
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password()));
    persistAuthentication(authentication, httpRequest, httpResponse);

    AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
    AppUser user = appUserRepository.findByEmail(principal.getEmail()).orElseThrow();
    return ResponseEntity.ok(UserResponse.from(user));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
    new SecurityContextLogoutHandler()
        .logout(httpRequest, httpResponse, SecurityContextHolder.getContext().getAuthentication());
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/me")
  public ResponseEntity<UserResponse> me(Authentication authentication) {
    AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
    AppUser user = appUserRepository.findByEmail(principal.getEmail()).orElseThrow();
    return ResponseEntity.ok(UserResponse.from(user));
  }

  @PostMapping("/change-password")
  public ResponseEntity<Void> changePassword(
      Authentication authentication, @Valid @RequestBody ChangePasswordRequest request) {
    AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
    AppUser user = appUserRepository.findByEmail(principal.getEmail()).orElseThrow();
    if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
      throw new InvalidCurrentPasswordException();
    }
    user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    appUserRepository.save(user);
    return ResponseEntity.noContent().build();
  }

  private void persistAuthentication(
      Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    securityContextRepository.saveContext(context, request, response);
  }
}
