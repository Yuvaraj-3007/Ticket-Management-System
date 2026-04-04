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

  it("renders the Tickets heading", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    expect(await screen.findByRole("heading", { name: "Tickets" })).toBeInTheDocument();
  });

  it("shows all expected column headers", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByRole("heading", { name: "Tickets" });

    for (const header of ["ID", "Title", "Category", "Priority", "Status", "Project", "Created"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
  });

  it("shows the ticket count subtitle — singular", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    expect(await screen.findByText(/1 ticket.*newest first/i)).toBeInTheDocument();
  });

  it("shows the ticket count subtitle — plural", async () => {
    await resolveWithTickets([TICKET_1, TICKET_2]);
    renderTickets();
    expect(await screen.findByText(/2 tickets.*newest first/i)).toBeInTheDocument();
  });

  // ─── Ticket data rendering ─────────────────────────────────────────────────

  it("displays the ticket ID and title", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    expect(await screen.findByText("TKT-0042")).toBeInTheDocument();
    expect(screen.getByText("Dashboard crashes on login")).toBeInTheDocument();
  });

  it("ticket ID matches TKT-XXXX format", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    expect(await screen.findByText(/^TKT-\d{4}$/)).toBeInTheDocument();
  });

  it("shows Category badge with correct label: Support", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByText("TKT-0042");
    const row = screen.getByRole("row", { name: /TKT-0042/i });
    expect(within(row).getByText("Support")).toBeInTheDocument();
  });

  it("shows Priority badge with correct label: Medium", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByText("TKT-0042");
    const row = screen.getByRole("row", { name: /TKT-0042/i });
    expect(within(row).getByText("Medium")).toBeInTheDocument();
  });

  it("shows Status badge with correct label: Open", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByText("TKT-0042");
    const row = screen.getByRole("row", { name: /TKT-0042/i });
    expect(within(row).getByText("Open")).toBeInTheDocument();
  });

  it("shows Project value", async () => {
    await resolveWithTickets([TICKET_1]);
    renderTickets();
    await screen.findByText("TKT-0042");
    const row = screen.getByRole("row", { name: /TKT-0042/i });
    expect(within(row).getByText("Email Intake")).toBeInTheDocument();
  });

  it("ticket count in subtitle matches the number of rendered rows", async () => {
    await resolveWithTickets([TICKET_1, TICKET_2]);
    renderTickets();
    await screen.findByText(/2 tickets/i);

    const rows = screen.getAllByRole("row");
    const dataRows = rows.length - 1; // exclude header
    expect(dataRows).toBe(2);
  });

  // ─── Ordering ─────────────────────────────────────────────────────────────

  it("renders tickets in the order returned by the API (newest first)", async () => {
    await resolveWithTickets([TICKET_1, TICKET_2]); // TKT-0042 before TKT-0041
    renderTickets();
    await screen.findByText("TKT-0042");

    const rows = screen.getAllByRole("row");
    const rowTexts = rows.map((r: HTMLElement) => r.textContent ?? "");
    const idx1 = rowTexts.findIndex((t: string) => t.includes("TKT-0042"));
    const idx2 = rowTexts.findIndex((t: string) => t.includes("TKT-0041"));
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
    // Column headers are visible in the skeleton loading state
    expect(screen.getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
  });

  // ─── Assigned-to sub-line ─────────────────────────────────────────────────

  it("shows assigned-to name when ticket is assigned", async () => {
    const assigned: ApiTicket = {
      ...TICKET_1,
      assignedTo: { id: "agent-id", name: "Bob Agent" },
    };
    await resolveWithTickets([assigned]);
    renderTickets();
    expect(await screen.findByText(/Assigned to Bob Agent/i)).toBeInTheDocument();
  });

  it("does not show assigned-to line when ticket is unassigned", async () => {
    await resolveWithTickets([TICKET_1]); // assignedTo: null
    renderTickets();
    await screen.findByText("TKT-0042");
    expect(screen.queryByText(/Assigned to/i)).not.toBeInTheDocument();
  });
});

// ─── Sorting ──────────────────────────────────────────────────────────────────

describe("Tickets page — sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // All fetches resolve with a single ticket throughout sorting tests
    mockedGet.mockResolvedValue({ data: makePage([TICKET_1]) });
  });

  it("initial fetch sends sortBy=createdAt&sortOrder=desc", async () => {
    renderTickets();
    await screen.findByText("TKT-0042");
    expect(mockedGet).toHaveBeenCalledWith(
      expect.stringContaining("sortBy=createdAt&sortOrder=desc"),
      expect.any(Object)
    );
  });

  it("shows 'newest first' subtitle by default", async () => {
    renderTickets();
    expect(await screen.findByText(/newest first/i)).toBeInTheDocument();
  });

  it("clicking Priority column sends sortBy=priority&sortOrder=asc", async () => {
    renderTickets();
    await screen.findByText("TKT-0042");

    await userEvent.click(screen.getByRole("columnheader", { name: "Priority" }));

    await waitFor(() => {
      expect(mockedGet).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=priority&sortOrder=asc"),
        expect.any(Object)
      );
    });
  });

  it("clicking Priority column twice sends sortOrder=desc", async () => {
    renderTickets();
    await screen.findByText("TKT-0042");

    await userEvent.click(screen.getByRole("columnheader", { name: "Priority" }));
    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith(
        expect.stringContaining("sortOrder=asc"),
        expect.any(Object)
      )
    );

    await userEvent.click(screen.getByRole("columnheader", { name: "Priority" }));
    await waitFor(() => {
      expect(mockedGet).toHaveBeenLastCalledWith(
        expect.stringContaining("sortBy=priority&sortOrder=desc"),
        expect.any(Object)
      );
    });
  });

  it("subtitle updates to 'sorted by priority (A→Z)' after first click", async () => {
    renderTickets();
    await screen.findByText("TKT-0042");

    await userEvent.click(screen.getByRole("columnheader", { name: "Priority" }));

    expect(await screen.findByText(/sorted by priority.*A→Z/)).toBeInTheDocument();
  });

  it("subtitle updates to 'sorted by priority (Z→A)' after second click", async () => {
    renderTickets();
    await screen.findByText("TKT-0042");

    await userEvent.click(screen.getByRole("columnheader", { name: "Priority" }));
    await screen.findByText(/A→Z/);

    await userEvent.click(screen.getByRole("columnheader", { name: "Priority" }));

    expect(await screen.findByText(/Z→A/)).toBeInTheDocument();
  });

  it("Title column header has no cursor-pointer (sorting disabled)", async () => {
    renderTickets();
    await screen.findByText("TKT-0042");

    expect(screen.getByRole("columnheader", { name: "Title" })).not.toHaveClass("cursor-pointer");
    expect(screen.getByRole("columnheader", { name: "Priority" })).toHaveClass("cursor-pointer");
  });
});
