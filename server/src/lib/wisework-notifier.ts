/**
 * Fire-and-forget notifier: calls the Wisework backend when a ticket is assigned.
 * Any error here is logged but never propagates — Wisework downtime must not
 * break ticket assignment in Right Tracker.
 */

const WISEWORK_URL     = process.env.WISEWORK_NOTIFICATION_URL ?? "";
const WISEWORK_API_KEY = process.env.WISEWORK_NOTIFICATION_API_KEY ?? "";

export interface WiseworkTicketPayload {
  employeeEmail:  string;
  ticketId:       string;
  ticketTitle:    string;
  ticketUrl:      string;
  priority:       string;
  assignedByName: string;
}

async function wiseworkFetch(path: string, method: string, body: object): Promise<void> {
  if (!WISEWORK_URL || !WISEWORK_API_KEY) return;
  try {
    const res = await fetch(`${WISEWORK_URL}/api/v1${path}`, {
      method,
      headers: { "Content-Type": "application/json", "x-api-key": WISEWORK_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[wisework-notifier] Non-OK response ${res.status}: ${text}`);
    }
  } catch (err) {
    console.warn("[wisework-notifier] Failed to notify Wisework:", err instanceof Error ? err.message : String(err));
  }
}

export async function notifyWiseworkAssignment(payload: WiseworkTicketPayload): Promise<void> {
  await wiseworkFetch("/ticket-notifications", "POST", payload);
}

export async function notifyWiseworkPriorityUpdate(ticketId: string, priority: string): Promise<void> {
  await wiseworkFetch(`/ticket-notifications/priority`, "PATCH", { ticketId, priority });
}
