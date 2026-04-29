// Shared STATUS_CONFIG — used by Tickets.tsx and TicketSlidePanel.tsx
// CSS variables handle light/dark automatically — defined in index.css
export const STATUS_CONFIG: Record<string, { dot: string; text: string; bg: string }> = {
  UN_ASSIGNED:        { dot: "var(--status-un-assigned-dot)",          text: "var(--status-un-assigned-text)",          bg: "var(--status-un-assigned-bg)"         },
  OPEN_NOT_STARTED:   { dot: "var(--status-open-not-started-dot)",     text: "var(--status-open-not-started-text)",     bg: "var(--status-open-not-started-bg)"    },
  OPEN_IN_PROGRESS:   { dot: "var(--status-open-in-progress-dot)",     text: "var(--status-open-in-progress-text)",     bg: "var(--status-open-in-progress-bg)"    },
  OPEN_QA:            { dot: "var(--status-open-qa-dot)",              text: "var(--status-open-qa-text)",              bg: "var(--status-open-qa-bg)"             },
  OPEN_DONE:          { dot: "var(--status-open-done-dot)",            text: "var(--status-open-done-text)",            bg: "var(--status-open-done-bg)"           },
  WAITING_FOR_CLIENT: { dot: "var(--status-waiting-for-client-dot)",   text: "var(--status-waiting-for-client-text)",   bg: "var(--status-waiting-for-client-bg)"  },
  CLOSED:             { dot: "var(--status-closed-dot)",               text: "var(--status-closed-text)",               bg: "var(--status-closed-bg)"              },
  // Implementation-request workflow statuses (literal colors — design tokens optional later)
  SUBMITTED:          { dot: "#64748b", text: "#475569", bg: "#f1f5f9" },
  ADMIN_REVIEW:       { dot: "#3b82f6", text: "#1d4ed8", bg: "#dbeafe" },
  PLANNING:           { dot: "#f59e0b", text: "#b45309", bg: "#fef3c7" },
  CUSTOMER_APPROVAL:  { dot: "#a855f7", text: "#7e22ce", bg: "#f3e8ff" },
  APPROVED:           { dot: "#22c55e", text: "#15803d", bg: "#dcfce7" },
};
