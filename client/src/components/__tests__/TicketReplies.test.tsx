import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ApiComment } from "@tms/core";
import axios from "axios";
import { TicketReplies } from "../TicketReplies";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("axios");

const mockedAxios = vi.mocked(axios);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AGENT_COMMENT: ApiComment = {
  id:         "c-1",
  content:    "This is an agent reply.",
  senderType: "AGENT",
  author:     { id: "user-1", name: "Alice Agent" },
  createdAt:  "2026-04-01T10:00:00.000Z",
};

const CUSTOMER_COMMENT: ApiComment = {
  id:         "c-2",
  content:    "This is a customer reply.",
  senderType: "CUSTOMER",
  author:     { id: "user-2", name: "John Customer" },
  createdAt:  "2026-04-01T11:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderReplies(ticketId = "TKT-0001") {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <TicketReplies ticketId={ticketId} />
    </QueryClientProvider>
  );
}

function setupGetEmpty() {
  mockedAxios.get = vi.fn().mockResolvedValue({ data: [] });
}

function setupGetWithComments(comments: ApiComment[]) {
  mockedAxios.get = vi.fn().mockResolvedValue({ data: comments });
}

// ---------------------------------------------------------------------------
// Suite 1 — Initial rendering
// ---------------------------------------------------------------------------

describe("TicketReplies — initial rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGetEmpty();
  });

  it("renders the Replies heading", async () => {
    renderReplies();
    expect(await screen.findByText("Replies")).toBeInTheDocument();
  });

  it("shows the original customer message bubble when comments list is empty", async () => {
    // The component now always shows the original ticket message as the first bubble.
    // When the ticket query has no cached data the component shows a skeleton, so
    // we verify there is no "No replies yet." text (that text no longer exists).
    renderReplies();
    await waitFor(() =>
      expect(screen.queryByText("No replies yet.")).not.toBeInTheDocument()
    );
  });

  it("does not show count in heading when there are no replies", async () => {
    renderReplies();
    await waitFor(() => expect(screen.getByText("Replies")).toBeInTheDocument());
    expect(screen.queryByText(/Replies \(/)).not.toBeInTheDocument();
  });

  it("renders the Reply textarea", async () => {
    renderReplies();
    await screen.findByText("Replies");
    expect(screen.getByPlaceholderText("Write a reply…")).toBeInTheDocument();
  });

  it("renders the Post Reply button", async () => {
    renderReplies();
    await screen.findByText("Replies");
    expect(screen.getByRole("button", { name: "Post Reply" })).toBeInTheDocument();
  });

  it("Post Reply button is disabled when textarea is empty", async () => {
    renderReplies();
    await screen.findByText("Replies");
    expect(screen.getByRole("button", { name: "Post Reply" })).toBeDisabled();
  });

  it("fetches comments for the given ticketId on mount", async () => {
    renderReplies("TKT-0042");
    await screen.findByText("Replies");
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/tickets/TKT-0042/comments"),
      expect.any(Object)
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Thread rendering
// ---------------------------------------------------------------------------

describe("TicketReplies — thread rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders reply content for each comment", async () => {
    setupGetWithComments([AGENT_COMMENT, CUSTOMER_COMMENT]);
    renderReplies();
    await waitFor(() => {
      expect(screen.getByText("This is an agent reply.")).toBeInTheDocument();
      expect(screen.getByText("This is a customer reply.")).toBeInTheDocument();
    });
  });

  it("renders author names for each comment", async () => {
    setupGetWithComments([AGENT_COMMENT, CUSTOMER_COMMENT]);
    renderReplies();
    await waitFor(() => {
      expect(screen.getByText("Alice Agent")).toBeInTheDocument();
      expect(screen.getByText("John Customer")).toBeInTheDocument();
    });
  });

  it("renders Agent badge for an AGENT comment", async () => {
    setupGetWithComments([AGENT_COMMENT]);
    renderReplies();
    await waitFor(() => {
      const badge = document.querySelector('[data-slot="badge"]') as HTMLElement;
      expect(badge.textContent).toBe("Agent");
    });
  });

  it("renders Customer badge for a CUSTOMER comment", async () => {
    setupGetWithComments([CUSTOMER_COMMENT]);
    renderReplies();
    await waitFor(() => {
      const badge = document.querySelector('[data-slot="badge"]') as HTMLElement;
      expect(badge.textContent).toBe("Customer");
    });
  });

  it("shows reply count in heading when comments exist", async () => {
    setupGetWithComments([AGENT_COMMENT, CUSTOMER_COMMENT]);
    renderReplies();
    await waitFor(() =>
      expect(screen.getByText("Replies (2)")).toBeInTheDocument()
    );
  });

  it("shows reply count of 1 for a single comment", async () => {
    setupGetWithComments([AGENT_COMMENT]);
    renderReplies();
    await waitFor(() =>
      expect(screen.getByText("Replies (1)")).toBeInTheDocument()
    );
  });

  it("does not show No replies yet when comments are present", async () => {
    setupGetWithComments([AGENT_COMMENT]);
    renderReplies();
    await waitFor(() =>
      expect(screen.queryByText("No replies yet.")).not.toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Form interaction
// ---------------------------------------------------------------------------

describe("TicketReplies — form interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGetEmpty();
  });

  it("Post Reply button becomes enabled after typing content", async () => {
    renderReplies();
    await screen.findByText("Replies");

    await userEvent.type(screen.getByPlaceholderText("Write a reply…"), "Hello");
    expect(screen.getByRole("button", { name: "Post Reply" })).toBeEnabled();
  });

  it("Post Reply button stays disabled when content is only whitespace", async () => {
    renderReplies();
    await screen.findByText("Replies");

    await userEvent.type(screen.getByPlaceholderText("Write a reply…"), "   ");
    expect(screen.getByRole("button", { name: "Post Reply" })).toBeDisabled();
  });

  it("clicking Post Reply calls POST with content only (senderType derived server-side)", async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({ data: AGENT_COMMENT });

    renderReplies();
    await screen.findByText("Replies");

    await userEvent.type(screen.getByPlaceholderText("Write a reply…"), "My reply");
    await userEvent.click(screen.getByRole("button", { name: "Post Reply" }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/TKT-0001/comments"),
        { content: "My reply" },
        expect.any(Object)
      );
    });
  });

  it("textarea is cleared after a successful POST", async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({ data: AGENT_COMMENT });

    renderReplies();
    await screen.findByText("Replies");

    const textarea = screen.getByPlaceholderText("Write a reply…") as HTMLTextAreaElement;
    await userEvent.type(textarea, "My reply");
    await userEvent.click(screen.getByRole("button", { name: "Post Reply" }));

    await waitFor(() => expect(textarea.value).toBe(""));
  });

  it("shows error message when POST fails", async () => {
    mockedAxios.post = vi.fn().mockRejectedValue(new Error("Server error"));

    renderReplies();
    await screen.findByText("Replies");

    await userEvent.type(screen.getByPlaceholderText("Write a reply…"), "My reply");
    await userEvent.click(screen.getByRole("button", { name: "Post Reply" }));

    await waitFor(() =>
      expect(screen.getByText(/failed to post reply/i)).toBeInTheDocument()
    );
  });

  it("no error message is shown before a failed POST", async () => {
    renderReplies();
    await screen.findByText("Replies");
    expect(screen.queryByText(/failed to post reply/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Query invalidation
// ---------------------------------------------------------------------------

describe("TicketReplies — query invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-fetches comments after a successful POST", async () => {
    setupGetEmpty();
    mockedAxios.post = vi.fn().mockResolvedValue({ data: AGENT_COMMENT });

    renderReplies();
    await screen.findByText("Replies");

    await userEvent.type(screen.getByPlaceholderText("Write a reply…"), "New reply");
    await userEvent.click(screen.getByRole("button", { name: "Post Reply" }));

    await waitFor(() => {
      const getCalls = (mockedAxios.get as ReturnType<typeof vi.fn>).mock.calls as [string][];
      const commentRefetches = getCalls.filter(([url]) =>
        url.includes("/api/tickets/TKT-0001/comments")
      );
      expect(commentRefetches.length).toBeGreaterThanOrEqual(2); // initial + after POST
    });
  });

  it("does not re-fetch when POST fails", async () => {
    setupGetEmpty();
    mockedAxios.post = vi.fn().mockRejectedValue(new Error("fail"));

    renderReplies();
    await screen.findByText("Replies");

    const initialGetCount = (mockedAxios.get as ReturnType<typeof vi.fn>).mock.calls.length;

    await userEvent.type(screen.getByPlaceholderText("Write a reply…"), "Bad reply");
    await userEvent.click(screen.getByRole("button", { name: "Post Reply" }));

    await waitFor(() =>
      expect(screen.getByText(/failed to post reply/i)).toBeInTheDocument()
    );

    const finalGetCount = (mockedAxios.get as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(finalGetCount).toBe(initialGetCount); // no extra refetch
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Polish button
// ---------------------------------------------------------------------------

describe("TicketReplies — Polish button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGetEmpty();
  });

  it("renders the Polish button", async () => {
    renderReplies();
    await screen.findByText("Replies");
    expect(screen.getByRole("button", { name: /Polish/i })).toBeInTheDocument();
  });

  it("Polish button is disabled when textarea is empty", async () => {
    renderReplies();
    await screen.findByText("Replies");
    expect(screen.getByRole("button", { name: /Polish/i })).toBeDisabled();
  });

  it("Polish button is enabled after typing content", async () => {
    renderReplies();
    await screen.findByText("Replies");
    await userEvent.type(screen.getByPlaceholderText("Write a reply…"), "fix the issue");
    expect(screen.getByRole("button", { name: /Polish/i })).toBeEnabled();
  });

  it("clicking Polish calls POST to /polish with current content", async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { polished: "We have resolved the issue." } });

    renderReplies();
    await screen.findByText("Replies");

    await userEvent.type(screen.getByPlaceholderText("Write a reply…"), "fix the issue");
    await userEvent.click(screen.getByRole("button", { name: /Polish/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/TKT-0001/polish"),
        { content: "fix the issue" },
        expect.any(Object)
      );
    });
  });

  it("replaces textarea content with polished text on success", async () => {
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { polished: "We have resolved the issue." } });

    renderReplies();
    await screen.findByText("Replies");

    const textarea = screen.getByPlaceholderText("Write a reply…") as HTMLTextAreaElement;
    await userEvent.type(textarea, "fix the issue");
    await userEvent.click(screen.getByRole("button", { name: /Polish/i }));

    await waitFor(() => expect(textarea.value).toBe("We have resolved the issue."));
  });

  it("shows error message when Polish fails", async () => {
    mockedAxios.post = vi.fn().mockRejectedValue(new Error("AI error"));

    renderReplies();
    await screen.findByText("Replies");

    await userEvent.type(screen.getByPlaceholderText("Write a reply…"), "fix the issue");
    await userEvent.click(screen.getByRole("button", { name: /Polish/i }));

    await waitFor(() =>
      expect(screen.getByText(/failed to polish reply/i)).toBeInTheDocument()
    );
  });

  it("no polish error shown before a failed attempt", async () => {
    renderReplies();
    await screen.findByText("Replies");
    expect(screen.queryByText(/failed to polish reply/i)).not.toBeInTheDocument();
  });

  it("textarea content is unchanged when Polish fails", async () => {
    mockedAxios.post = vi.fn().mockRejectedValue(new Error("AI error"));

    renderReplies();
    await screen.findByText("Replies");

    const textarea = screen.getByPlaceholderText("Write a reply…") as HTMLTextAreaElement;
    await userEvent.type(textarea, "fix the issue");
    await userEvent.click(screen.getByRole("button", { name: /Polish/i }));

    await waitFor(() =>
      expect(screen.getByText(/failed to polish reply/i)).toBeInTheDocument()
    );
    expect(textarea.value).toBe("fix the issue");
  });
});
