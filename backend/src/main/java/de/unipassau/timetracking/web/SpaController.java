package de.unipassau.timetracking.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Forwards direct navigations/refreshes on client-side routes to the SPA shell so React Router can
 * take over. New top-level routes added in the frontend must be listed here too.
 */
@Controller
public class SpaController {

  @GetMapping({"/login", "/register"})
  public String forwardToIndex() {
    return "forward:/index.html";
  }
}
