import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { describe, it, expect, beforeEach, vi } from "vitest";

import Users from "../Users";
import { ROLES } from "@tms/core";

// Use delay:null globally to avoid keystroke delays causing test timeouts
const user = userEvent.setup({ delay: null });

vi.mock("axios");
vi.mock("@/components/Navbar", () => ({ default: () => <div>Navbar</div> }));
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { name: "Admin", role: "ADMIN" } } }),
  signOut: vi.fn(),
}));

const mockedAxios = vi.mocked(axios);

// Fresh QueryClient per test — prevents error state leaking between tests
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderUsers() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <Users />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Open "Add User" dialog and wait for it to be visible
async function openAddUserDialog() {
  mockedAxios.get = vi.fn().mockResolvedValue({ data: [] });
  renderUsers();
  await waitFor(() => screen.getByRole("button", { name: /add user/i }));
  await user.click(screen.getByRole("button", { name: /add user/i }));
  await waitFor(() => screen.getByRole("dialog"));
}

describe("Users page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders a list of users returned from the API", async () => {
    const users = [
      {
        id: "1",
        name: "Alice",
        email: "alice@example.com",
        role: ROLES.ADMIN,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Bob",
        email: "bob@example.com",
        role: ROLES.AGENT,
        isActive: false,
        createdAt: new Date().toISOString(),
      },
    ];

    mockedAxios.get = vi.fn().mockResolvedValue({ data: users });

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <Users />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("shows empty state when no users exist", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [] });

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <Users />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no users found/i)
      ).toBeInTheDocument();
    });
  });
});

describe("Create user form", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("opens the dialog when Add User is clicked", async () => {
    await openAddUserDialog();
    expect(screen.getByRole("heading", { name: /add new user/i })).toBeInTheDocument();
  });

  it("renders all form fields", async () => {
    await openAddUserDialog();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows validation errors for empty name and email", async () => {
    await openAddUserDialog();
    await user.click(screen.getByRole("button", { name: /create user/i }));
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it("shows password required error when name and email are valid but password is blank", async () => {
    await openAddUserDialog();
    await user.type(screen.getByLabelText(/^name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    // password left blank
    await user.click(screen.getByRole("button", { name: /create user/i }));
    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid email", async () => {
    await openAddUserDialog();
    await user.type(screen.getByLabelText(/^name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create user/i }));
    await waitFor(() => {
      expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for short password", async () => {
    await openAddUserDialog();
    await user.type(screen.getByLabelText(/^name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "short");
    await user.click(screen.getByRole("button", { name: /create user/i }));
    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it("submits valid data and closes the dialog on success", async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({
      data: {
        id: "new-1",
        name: "New User",
        email: "new@example.com",
        role: ROLES.AGENT,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    });
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [] });

    renderUsers();
    await waitFor(() => screen.getByRole("button", { name: /add user/i }));
    await user.click(screen.getByRole("button", { name: /add user/i }));
    await waitFor(() => screen.getByRole("dialog"));

    await user.type(screen.getByLabelText(/^name/i), "New User");
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/users"),
        expect.objectContaining({ name: "New User", email: "new@example.com" }),
        expect.objectContaining({ withCredentials: true })
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  }, 15000);

  it("shows server error message on 500 response", async () => {
    mockedAxios.post = vi.fn().mockRejectedValue({
      response: { data: { error: "Failed to create user" } },
    });
    await openAddUserDialog();

    await user.type(screen.getByLabelText(/^name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create user/i)).toBeInTheDocument();
    });
  });

  it("shows server field error for duplicate email (409)", async () => {
    mockedAxios.post = vi.fn().mockRejectedValue({
      response: { data: { error: "A user with this email already exists" } },
    });
    await openAddUserDialog();

    await user.type(screen.getByLabelText(/^name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "dupe@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it("closes the dialog when Cancel is clicked", async () => {
    await openAddUserDialog();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
