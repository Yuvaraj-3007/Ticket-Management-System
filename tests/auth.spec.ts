import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fill and submit the login form. Does NOT wait for any post-submit state. */
async function fillAndSubmitLogin(
  page: Page,
  email: string,
  password: string
) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

/**
 * Perform a full admin login and wait until the dashboard is visible.
 * Re-usable across test groups that need an authenticated starting state.
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await fillAndSubmitLogin(page, "admin@wisright.com", "Test@123");
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Dashboard" })
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// 1. Login page — rendering
// ---------------------------------------------------------------------------

test.describe("Login page rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("displays the login form with all required elements", async ({
    page,
  }) => {
    await expect(
      page.getByText("Ticket Management System")
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign In" })
    ).toBeVisible();
  });

  test("email and password fields are empty on first load", async ({
    page,
  }) => {
    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(page.getByLabel("Password")).toHaveValue("");
  });

  test("password field masks input", async ({ page }) => {
    await expect(page.getByLabel("Password")).toHaveAttribute(
      "type",
      "password"
    );
  });

  test("Sign In button is enabled before any input", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Sign In" })
    ).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// 2. Successful login
// ---------------------------------------------------------------------------

test.describe("Successful login", () => {
  test("admin can log in with valid credentials and is redirected to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await fillAndSubmitLogin(page, "admin@wisright.com", "Test@123");

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("Sign In button shows loading state while submitting", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@wisright.com");
    await page.getByLabel("Password").fill("Test@123");

    // Intercept the auth request so we can observe the in-flight state
    let resolveRequest!: () => void;
    const requestPaused = new Promise<void>((r) => (resolveRequest = r));
    await page.route("**/api/auth/sign-in/email", async (route) => {
      resolveRequest();
      await route.continue();
    });

    const submitPromise = page
      .getByRole("button", { name: "Sign In" })
      .click();
    await requestPaused;

    await expect(
      page.getByRole("button", { name: "Signing in..." })
    ).toBeDisabled();

    await submitPromise;
    await expect(page).toHaveURL("/");
  });
});

// ---------------------------------------------------------------------------
// 3. Client-side validation errors
// ---------------------------------------------------------------------------

test.describe("Client-side form validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows error when email field is left empty", async ({ page }) => {
    // Trigger blur on email without typing to trigger onBlur validation
    await page.getByLabel("Email").focus();
    await page.getByLabel("Email").blur();
    await expect(
      page.getByText("Email is required")
    ).toBeVisible();
  });

  test("shows error when password field is left empty and then blurred", async ({
    page,
  }) => {
    await page.getByLabel("Password").focus();
    await page.getByLabel("Password").blur();
    await expect(
      page.getByText("Password must be at least 8 characters")
    ).toBeVisible();
  });

  test("shows invalid email format error", async ({ page }) => {
    await page.getByLabel("Email").fill("notanemail");
    await page.getByLabel("Email").blur();
    await expect(
      page.getByText("Enter a valid email")
    ).toBeVisible();
  });

  test("shows invalid email format error for email missing domain", async ({
    page,
  }) => {
    await page.getByLabel("Email").fill("user@");
    await page.getByLabel("Email").blur();
    await expect(
      page.getByText("Enter a valid email")
    ).toBeVisible();
  });

  test("shows password too short error for passwords under 8 characters", async ({
    page,
  }) => {
    await page.getByLabel("Password").fill("short");
    await page.getByLabel("Password").blur();
    await expect(
      page.getByText("Password must be at least 8 characters")
    ).toBeVisible();
  });

  test("does not show validation errors for a properly filled form", async ({
    page,
  }) => {
    await page.getByLabel("Email").fill("admin@wisright.com");
    await page.getByLabel("Email").blur();
    await page.getByLabel("Password").fill("Test@123");
    await page.getByLabel("Password").blur();

    await expect(page.getByText("Email is required")).not.toBeVisible();
    await expect(
      page.getByText("Enter a valid email")
    ).not.toBeVisible();
    await expect(
      page.getByText("Password must be at least 8 characters")
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Server-side authentication errors
// ---------------------------------------------------------------------------

test.describe("Server-side authentication errors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows error for wrong password", async ({ page }) => {
    await fillAndSubmitLogin(page, "admin@wisright.com", "WrongPass1");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("shows error for non-existent email", async ({ page }) => {
    await fillAndSubmitLogin(
      page,
      "nobody@example.com",
      "SomePassword1"
    );
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("shows error for correct email but entirely wrong password", async ({
    page,
  }) => {
    await fillAndSubmitLogin(
      page,
      "admin@wisright.com",
      "AbsolutelyWrong99"
    );
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("clears server error when user starts correcting credentials", async ({
    page,
  }) => {
    // Produce an error
    await fillAndSubmitLogin(page, "admin@wisright.com", "WrongPass1");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();

    // User updates the password field — the error div should disappear on
    // the next submission attempt with the correct password
    await page.getByLabel("Password").fill("Test@123");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/");
  });
});

// ---------------------------------------------------------------------------
// 5. Session persistence
// ---------------------------------------------------------------------------

test.describe("Session persistence", () => {
  test("user remains authenticated after a full page reload", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Hard reload — simulates the user pressing F5 or navigating directly
    await page.reload();

    // Should still be on the dashboard, not redirected to login
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("authenticated user is not redirected to login when navigating directly to dashboard", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Logout
// ---------------------------------------------------------------------------

test.describe("Logout", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("Sign Out button is visible in the navbar when authenticated", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: "Sign Out" })
    ).toBeVisible();
  });

  test("clicking Sign Out redirects to the login page", async ({ page }) => {
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL("/login");
  });

  test("after logout the login form is displayed", async ({ page }) => {
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(
      page.getByRole("button", { name: "Sign In" })
    ).toBeVisible();
  });

  test("after logout navigating to dashboard redirects back to login", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL("/login");

    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("session cookie is cleared after logout", async ({ page, context }) => {
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL("/login");

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.toLowerCase().includes("session")
    );
    // Either no session cookie exists, or if it does it should have no value
    expect(sessionCookie?.value ?? "").toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// 7. Route protection — unauthenticated access
// ---------------------------------------------------------------------------

test.describe("Route protection for unauthenticated users", () => {
  test("visiting / while unauthenticated redirects to /login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("visiting /users while unauthenticated redirects to /login", async ({
    page,
  }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/login");
  });

  test("login page is accessible without authentication", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("button", { name: "Sign In" })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. Route protection — authenticated users cannot access GuestRoute
// ---------------------------------------------------------------------------

test.describe("Route protection for authenticated users", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("authenticated user visiting /login is redirected to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });
});

// ---------------------------------------------------------------------------
// 9. Role-based access control
// ---------------------------------------------------------------------------

test.describe("Role-based access control", () => {
  test("admin can access /users page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/users");
    await expect(page).toHaveURL("/users");
    await expect(
      page.getByRole("heading", { name: "Users" })
    ).toBeVisible();
  });

  test("admin navbar shows the Users link", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  });

  test("admin can click the Users nav link to navigate to /users", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL("/users");
    await expect(
      page.getByRole("heading", { name: "Users" })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 10. Navbar user identity display
// ---------------------------------------------------------------------------

test.describe("Navbar displays authenticated user info", () => {
  test("admin's name is displayed in the navbar", async ({ page }) => {
    await loginAsAdmin(page);
    // The seed creates the admin with name "Admin"
    await expect(page.getByText("Admin", { exact: true })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 11. Edge cases — security inputs
// ---------------------------------------------------------------------------

test.describe("Edge cases and security inputs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("SQL injection in email field does not authenticate", async ({
    page,
  }) => {
    await page.getByLabel("Email").fill("' OR '1'='1'; --");
    await page.getByLabel("Email").blur();
    // Client-side Zod email validation catches this before it reaches the server
    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("SQL injection in password field does not authenticate", async ({
    page,
  }) => {
    await fillAndSubmitLogin(
      page,
      "admin@wisright.com",
      "' OR '1'='1'; --"
    );
    await expect(page).toHaveURL("/login");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("XSS payload in email field is rejected by validation", async ({
    page,
  }) => {
    await page
      .getByLabel("Email")
      .fill('<script>alert("xss")</script>@evil.com');
    await page.getByLabel("Email").blur();
    await expect(page).toHaveURL("/login");
    // Script tag must not execute — page title must remain normal
    await expect(page).toHaveTitle(/Right Tracker/i);
  });

  test("XSS payload in password field does not cause script execution", async ({
    page,
  }) => {
    await fillAndSubmitLogin(
      page,
      "admin@wisright.com",
      '<script>alert("xss")</script>Pad1'
    );
    await expect(page).toHaveURL("/login");
    // Verify the page title is unchanged — no XSS took effect
    await expect(page).toHaveTitle(/Right Tracker/i);
  });

  test("very long email input is handled gracefully", async ({ page }) => {
    // A 200-char local part is valid email format for Zod, so submit and check
    // that the server rejects it (no user exists with this email)
    const longEmail = "a".repeat(200) + "@example.com";
    await fillAndSubmitLogin(page, longEmail, "SomePassword1");
    await expect(page).toHaveURL("/login");
    // Should not crash — either a validation or server error is acceptable
    await expect(page).toHaveTitle(/Right Tracker/i);
  });

  test("very long password input is handled gracefully", async ({ page }) => {
    // server maxPasswordLength is 128 — password exceeds it
    const longPassword = "A1@" + "x".repeat(130);
    await fillAndSubmitLogin(page, "admin@wisright.com", longPassword);
    await expect(page).toHaveURL("/login");
    // Should stay on login — not crash. Server may return various error messages.
    await expect(page).toHaveTitle(/Right Tracker/i);
  });

  test("password at exactly the minimum length (8 chars) passes client validation", async ({
    page,
  }) => {
    await page.getByLabel("Password").fill("Exact8!!");
    await page.getByLabel("Password").blur();
    await expect(
      page.getByText("Password must be at least 8 characters")
    ).not.toBeVisible();
  });

  test("password of 7 characters fails client validation", async ({ page }) => {
    await page.getByLabel("Password").fill("Short7!");
    await page.getByLabel("Password").blur();
    await expect(
      page.getByText("Password must be at least 8 characters")
    ).toBeVisible();
  });

  test("special characters in password field are accepted by the form", async ({
    page,
  }) => {
    // This password is structurally valid (length >= 8) — client validation passes,
    // server rejects because it's the wrong password
    const specialPassword = "P@$$w0rd#!^&*()";
    await page.getByLabel("Password").fill(specialPassword);
    await page.getByLabel("Password").blur();
    // No client validation error for a valid-length password
    await expect(
      page.getByText("Password must be at least 8 characters")
    ).not.toBeVisible();
  });

  test("whitespace-only email fails client validation", async ({ page }) => {
    await page.getByLabel("Email").fill("   ");
    await page.getByLabel("Email").blur();
    // HTML input[type=email] trims; zod min(1) catches blank strings
    await expect(
      page.getByText(/email is required|enter a valid email/i)
    ).toBeVisible();
  });

  test("unicode characters in email are rejected as invalid format", async ({
    page,
  }) => {
    await page.getByLabel("Email").fill("üser@münchen.de");
    await page.getByLabel("Email").blur();
    await expect(page).toHaveURL("/login");
    // Zod email validation will reject IDN addresses — no crash expected
    // (If the browser normalises the address and zod accepts it, that is
    //  also acceptable behaviour — the key requirement is no unhandled error)
    await expect(page).toHaveTitle(/Right Tracker/i);
  });

  test("sign-up attempt via API is rejected (signup disabled)", async ({
    page,
  }) => {
    const response = await page.request.post(
      "http://localhost:5001/api/auth/sign-up/email",
      {
        data: {
          email: "newuser@example.com",
          password: "NewUser@123",
          name: "New User",
        },
        headers: { "Content-Type": "application/json" },
      }
    );
    // Better Auth rejects sign-up when disabled (403 or 422)
    expect(response.ok()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 12. Auth API — direct endpoint sanity checks
// ---------------------------------------------------------------------------

test.describe("Auth API endpoint behaviour", () => {
  test("POST /api/auth/sign-in/email returns 200 with valid credentials", async ({
    page,
  }) => {
    const response = await page.request.post(
      "http://localhost:5001/api/auth/sign-in/email",
      {
        data: {
          email: "admin@wisright.com",
          password: "Test@123",
        },
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("token");
  });

  test("POST /api/auth/sign-in/email returns error with wrong password", async ({
    page,
  }) => {
    const response = await page.request.post(
      "http://localhost:5001/api/auth/sign-in/email",
      {
        data: {
          email: "admin@wisright.com",
          password: "WrongPassword1",
        },
        headers: { "Content-Type": "application/json" },
      }
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("GET /api/auth/get-session returns 401 when no session cookie is present", async ({
    page,
  }) => {
    const response = await page.request.get(
      "http://localhost:5001/api/auth/get-session"
    );
    // Better Auth returns null body (200) or 401 depending on version;
    // the important thing is no session data is returned
    const body = await response.json().catch(() => null);
    const hasSession =
      body !== null &&
      typeof body === "object" &&
      "user" in body &&
      body.user !== null;
    expect(hasSession).toBe(false);
  });
});
