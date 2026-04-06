import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TICKET_TYPE, PRIORITY, STATUS, type ApiTicket } from "@tms/core";
import Tickets from "./Tickets";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: { user: { name: "Admin", role: "ADMIN" } },
    isPending: false,
  }),
  signOut: vi.fn(),
}));

vi.mock("axios");
import axios from "axios";
const mockedGet = vi.mocked(axios.get);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TICKET_1: ApiTicket = {
  id:          "id-1",
  ticketId:    "TKT-0042",
  title:       "Dashboard crashes on login",
  description: "From: Alice <alice@example.com>\n\nAfter logging in the dashboard throws a JS error.",
  type:        TICKET_TYPE.SUPPORT,
  priority:    PRIORITY.MEDIUM,
  status:      STATUS.OPEN,
  project:     "Email Intake",
  assignedTo:  null,
  createdBy:   { id: "admin-id", name: "Admin" },
  createdAt:   "2026-04-01T10:00:00.000Z",
  updatedAt:   "2026-04-01T10:00:00.000Z",
};

const TICKET_2: ApiTicket = {
  ...TICKET_1,
  id:        "id-2",
  ticketId:  "TKT-0041",
  title:     "Older login issue",
  createdAt: "2026-04-01T09:00:00.000Z",
  updatedAt: "2026-04-01T09:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderTickets(queryClient = makeQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/tickets"]}>
        <Tickets />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function makePage(tickets: ApiTicket[]) {
  return { data: tickets, total: tickets.length, page: 1, pageSize: 10, totalPages: 1 };
}

async function resolveWithTickets(tickets: ApiTicket[]) {
  mockedGet.mockResolvedValueOnce({ data: makePage(tickets) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Tickets page — component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Page structure ────────────────────────────────────────────────────────

  it("renders the All Tickets heading", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    expect(await screen.findByRole("heading", { name: "All Tickets" })).toBeInTheDocument();
  });

  it("shows all expected column headers", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByRole("heading", { name: "All Tickets" });

    for (const header of ["ID", "Subject", "Sender", "Status", "Category", "Priority", "Date"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
  });

  it("shows the ticket count in the stats chip — singular", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    // The stats chip shows the count as a number and "total tickets" label
    expect(await screen.findByText("1")).toBeInTheDocument();
    expect(await screen.findByText(/total tickets/i)).toBeInTheDocument();
  });

  it("shows the ticket count in the stats chip — plural", async () => {
    await resolveWithTickets([TICKET_1, TICKET_2]);
    renderTickets();
    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(await screen.findByText(/total tickets/i)).toBeInTheDocument();
  });

  it("shows both the ID and Priority columns", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByRole("heading", { name: "All Tickets" });

    expect(screen.getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Priority" })).toBeInTheDocument();
  });

  it("ticket count in stats chip matches the number of rendered rows", async () => {
    await resolveWithTickets([TICKET_1, TICKET_2]);
    renderTickets();
    await screen.findByText("2");

    const rows = screen.getAllByRole("row");
    const dataRows = rows.length - 1; // exclude header
    expect(dataRows).toBe(2);
  });

  // ─── Ticket data rendering ─────────────────────────────────────────────────

  it("displays the ticket title as a link", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    const link = await screen.findByRole("link", { name: "Dashboard crashes on login" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/tickets/TKT-0042");
  });

  it("shows sender name in the Sender column", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByText("Dashboard crashes on login");
    const row = screen.getByRole("row", { name: /Dashboard crashes on login/i });
    expect(within(row).getByText("Admin")).toBeInTheDocument();
  });

  it("shows project as subtitle in the Sender column", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByText("Dashboard crashes on login");
    const row = screen.getByRole("row", { name: /Dashboard crashes on login/i });
    expect(within(row).getByText("Email Intake")).toBeInTheDocument();
  });

  it("shows Category as plain text with correct label: Support", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByText("Dashboard crashes on login");
    const row = screen.getByRole("row", { name: /Dashboard crashes on login/i });
    expect(within(row).getByText("Support")).toBeInTheDocument();
  });

  it("shows Status badge with correct label: Open", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByText("Dashboard crashes on login");
    const row = screen.getByRole("row", { name: /Dashboard crashes on login/i });
    expect(within(row).getByText("Open")).toBeInTheDocument();
  });

  // ─── Ordering ─────────────────────────────────────────────────────────────

  it("renders tickets in the order returned by the API (newest first)", async () => {
    await resolveWithTickets([TICKET_1, TICKET_2]);
    renderTickets();
    await screen.findByText("Dashboard crashes on login");

    const rows = screen.getAllByRole("row");
    const rowTexts = rows.map((r: HTMLElement) => r.textContent ?? "");
    const idx1 = rowTexts.findIndex((t: string) => t.includes("Dashboard crashes on login"));
    const idx2 = rowTexts.findIndex((t: string) => t.includes("Older login issue"));
    expect(idx1).toBeLessThan(idx2);
  });

  // ─── Empty state ──────────────────────────────────────────────────────────

  it("shows empty state message when there are no tickets", async () => {
    await resolveWithTickets([]);
    renderTickets();
    expect(await screen.findByText(/no tickets yet/i)).toBeInTheDocument();
  });

  // ─── Error state ──────────────────────────────────────────────────────────

  it("shows error message when the API call fails", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Network error"));
    renderTickets();
    expect(await screen.findByText(/failed to load tickets/i)).toBeInTheDocument();
  });

  // ─── Loading state ────────────────────────────────────────────────────────

  it("shows skeleton rows while loading", () => {
    mockedGet.mockReturnValueOnce(new Promise(() => {})); // never resolves
    renderTickets();
    expect(screen.getByRole("columnheader", { name: "Subject" })).toBeInTheDocument();
  });
});

// ─── Sorting ──────────────────────────────────────────────────────────────────

describe("Tickets page — sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGet.mockResolvedValue({ data: makePage([TICKET_1]) });
  });

  it("initial fetch sends sortBy=createdAt&sortOrder=desc", async () => {
    renderTickets();
    await screen.findByText("Dashboard crashes on login");
    expect(mockedGet).toHaveBeenCalledWith(
      expect.stringContaining("sortBy=createdAt&sortOrder=desc"),
      expect.any(Object)
    );
  });

  it("stats chip shows 'total tickets' label by default (no filters active)", async () => {
    renderTickets();
    expect(await screen.findByText(/total tickets/i)).toBeInTheDocument();
  });

  it("clicking Status column sends sortBy=status&sortOrder=asc", async () => {
    renderTickets();
    await screen.findByText("Dashboard crashes on login");

    await userEvent.click(screen.getByRole("columnheader", { name: "Status" }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=status&sortOrder=asc"),
        expect.any(Object)
      );
    });
  });

  it("clicking Status column twice sends sortOrder=desc", async () => {
    renderTickets();
    await screen.findByText("Dashboard crashes on login");

    await userEvent.click(screen.getByRole("columnheader", { name: "Status" }));
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith(
        expect.stringContaining("sortOrder=asc"),
        expect.any(Object)
      )
    );

    await userEvent.click(screen.getByRole("columnheader", { name: "Status" }));
    await waitFor(() => {
      expect(mockedGet).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=status&sortOrder=desc"),
        expect.any(Object)
      );
    });
  });

  it("Status column header gains cursor-pointer after sorting is enabled", async () => {
    renderTickets();
    await screen.findByText("Dashboard crashes on login");

    expect(screen.getByRole("columnheader", { name: "Status" })).toHaveClass("cursor-pointer");
  });

  it("Subject column header has no cursor-pointer (sorting disabled)", async () => {
    renderTickets();
    await screen.findByText("Dashboard crashes on login");

    expect(screen.getByRole("columnheader", { name: "Subject" })).not.toHaveClass("cursor-pointer");
    expect(screen.getByRole("columnheader", { name: "Status" })).toHaveClass("cursor-pointer");
  });
});
