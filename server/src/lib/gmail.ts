import { google } from "googleapis";

// Stores the historyId from when watchInbox() was called.
// Only Pub/Sub notifications with a historyId >= this baseline are processed.
let watchStartHistoryId: string | null = null;
// True while drainUnreadMessages() is running — Pub/Sub notifications are ignored during this time.
let draining = false;

export function getWatchStartHistoryId() { return watchStartHistoryId; }
export function isCurrentlyDraining() { return draining; }

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

export function isGmailApiConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GMAIL_PUBSUB_TOPIC
  );
}

// Fetch a single email by Gmail message ID, return parsed fields
export async function fetchEmailById(messageId: string): Promise<{
  from: string;
  name: string | undefined;
  subject: string;
  body: string;
  isNewsletter: boolean;
}> {
  const gmail = google.gmail({ version: "v1", auth: getOAuth2Client() });
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = msg.data.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name)?.value ?? "";

  const fromHeader = get("from"); // "Name <email>" or bare "email"
  const subject    = get("subject") || "(no subject)";

  const nameMatch = fromHeader.match(/^([^<]+)<([^>]+)>/);
  const from      = nameMatch ? nameMatch[2].trim() : fromHeader.trim();
  const name      = nameMatch
    ? nameMatch[1].trim().replace(/[<>"'&]/g, "")
    : undefined;

  const body = extractPlainText(msg.data.payload) || "(no body)";

  // Marketing/newsletter emails are legally required to include List-Unsubscribe or List-Id headers.
  // Real customer support emails never have these headers.
  const precedence = get("precedence").toLowerCase();
  const isNewsletter = !!(
    get("list-unsubscribe") ||
    get("list-id") ||
    get("x-campaign-id") ||
    get("x-mailchimp-id") ||
    precedence === "bulk" ||
    precedence === "list"
  );

  return { from, name, subject, body, isNewsletter };
}

function extractPlainText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8").trim();
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  return "";
}

// Resolve a Gmail label name to its ID (e.g. "Support" → "Label_123456")
// Falls back to the name itself for system labels like "INBOX".
export async function resolveLabelId(labelName: string): Promise<string> {
  if (!labelName || labelName === "INBOX") return "INBOX";
  const gmail = google.gmail({ version: "v1", auth: getOAuth2Client() });
  const res = await gmail.users.labels.list({ userId: "me" });
  const found = res.data.labels?.find(
    (l) => l.name?.toLowerCase() === labelName.toLowerCase()
  );
  if (!found?.id) throw new Error(`Gmail label "${labelName}" not found`);
  return found.id;
}

// List recent UNREAD messages in the Primary inbox only (excludes Promotions/Updates/Social).
// markAsRead() must be called after each message is processed to prevent re-processing.
export async function listUnprocessedMessages(): Promise<{ id: string }[]> {
  const gmail = google.gmail({ version: "v1", auth: getOAuth2Client() });
  const res = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX", "UNREAD"],
    // Exclude automated/newsletter categories — only process human-sent emails
    q: "-category:promotions -category:updates -category:social -category:forums",
    maxResults: 10,
  });
  return (res.data.messages ?? []).filter((m): m is { id: string } => !!m.id);
}

// Drain ALL current unread messages by marking them as read WITHOUT creating tickets.
// Called on startup so only post-startup emails trigger ticket creation.
export async function drainUnreadMessages(): Promise<void> {
  const gmail = google.gmail({ version: "v1", auth: getOAuth2Client() });
  let pageToken: string | undefined;
  let total = 0;
  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX", "UNREAD"],
      maxResults: 500,
      pageToken,
    });
    const msgs = res.data.messages ?? [];
    if (msgs.length > 0) {
      await Promise.all(msgs.map((m) => m.id ? markAsRead(m.id).catch(() => {}) : Promise.resolve()));
      total += msgs.length;
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  if (total > 0) console.log(`[gmail] Drained ${total} pre-existing unread message(s) — no tickets created`);
}

// Mark a message as read (remove UNREAD label) to prevent duplicate processing
export async function markAsRead(messageId: string) {
  const gmail = google.gmail({ version: "v1", auth: getOAuth2Client() });
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

// Register Gmail push notifications to the configured Pub/Sub topic.
// Gmail watch expires after 7 days — call this on server startup.
export async function watchInbox(): Promise<void> {
  if (!isGmailApiConfigured()) return;
  try {
    const auth = getOAuth2Client();
    const gmail = google.gmail({ version: "v1", auth });

    // Verify token works first with a lightweight profile call
    const profile = await gmail.users.getProfile({ userId: "me" });
    console.log("[gmail] Authenticated as:", profile.data.emailAddress);

    const watchRes = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: process.env.GMAIL_PUBSUB_TOPIC,
        labelIds: ["INBOX"],
      },
    });

    // Store the baseline historyId — ignore any Pub/Sub notifications older than this
    watchStartHistoryId = watchRes.data.historyId ?? null;
    console.log("[gmail] Inbox watch registered with Pub/Sub (baseline historyId:", watchStartHistoryId, ")");

    // Drain ALL pre-existing unread messages so only post-startup emails create tickets.
    // Set draining=true first so Pub/Sub notifications received during drain are ignored.
    draining = true;
    await drainUnreadMessages();
    draining = false;
  } catch (err: any) {
    const code   = err?.response?.status ?? err?.code;
    const data   = err?.response?.data ?? err?.message ?? String(err);
    const isTokenExpired = err?.response?.data?.error === "invalid_grant";
    if (isTokenExpired) {
      console.warn("[gmail] Refresh token expired — Gmail Pub/Sub disabled. Re-run scripts/gmail-auth.ts to fix.");
    } else {
      console.error(`[gmail] Failed to start inbox watch (HTTP ${code}):`, JSON.stringify(data, null, 2));
    }
  }
}
