import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const IMAP_HOST        = process.env.IMAP_HOST        ?? "outlook.office365.com";
const IMAP_PORT        = Number(process.env.IMAP_PORT ?? 993);
const SUPPORT_EMAIL    = process.env.SUPPORT_EMAIL    ?? "";
const SUPPORT_PASSWORD = process.env.SUPPORT_PASSWORD ?? "";

export interface EmailData {
  uid:          number;
  from:         string;
  name:         string | undefined;
  subject:      string;
  body:         string;
  isNewsletter: boolean;
}

export function isImapConfigured(): boolean {
  return !!(IMAP_HOST && SUPPORT_EMAIL && SUPPORT_PASSWORD);
}

let client: ImapFlow | null = null;

export function resetImapClient(): void {
  client = null;
}

// Prevent concurrent fetches (mirrors gmailProcessing flag)
let imapProcessing = false;

function isNewsletter(headers: Map<string, string>): boolean {
  const newsletterHeaders = ["list-unsubscribe", "list-id", "x-campaign-id", "x-mailchimp-id"];
  for (const name of newsletterHeaders) {
    if (headers.has(name)) return true;
  }
  const precedence = headers.get("precedence") ?? "";
  return precedence === "bulk" || precedence === "list";
}

async function drainUnreadMessages(c: ImapFlow): Promise<void> {
  const result = await c.search({ seen: false }, { uid: true });
  const uids = result === false ? [] : result;
  if (uids.length > 0) {
    await c.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    console.log("[imap] Drained %d pre-existing UNSEEN message(s)", uids.length);
  }
}

async function fetchAndProcessNewMessages(
  c: ImapFlow,
  callback: (data: EmailData) => Promise<void>,
): Promise<void> {
  if (imapProcessing) {
    console.log("[imap] Already processing — skipping concurrent fetch");
    return;
  }
  imapProcessing = true;

  try {
    const result = await c.search({ seen: false }, { uid: true });
    const uids = result === false ? [] : result;
    if (uids.length === 0) return;

    console.log("[imap] Found %d new message(s)", uids.length);

    for (const uid of uids) {
      let rawSource: Buffer | undefined;

      // Fetch raw RFC822 source for this UID
      for await (const msg of c.fetch([uid], { source: true }, { uid: true })) {
        rawSource = msg.source;
      }

      if (!rawSource) continue;

      // Mark \Seen BEFORE processing — prevents reprocessing if server crashes mid-processing
      await c.messageFlagsAdd([uid], ["\\Seen"], { uid: true });

      const parsed = await simpleParser(rawSource, { skipHtmlToText: false });

      const fromAddress = parsed.from?.value?.[0]?.address ?? "";
      const fromName    = parsed.from?.value?.[0]?.name || undefined;
      const subject     = (parsed.subject ?? "").trim() || "(no subject)";
      const body        = (parsed.text ?? "").toString().trim();

      // Build a flat headers map for newsletter detection
      const headersMap = new Map<string, string>();
      parsed.headerLines.forEach(({ key, line }) => {
        headersMap.set(key.toLowerCase(), line.toLowerCase());
      });

      const data: EmailData = {
        uid,
        from:         fromAddress,
        name:         fromName,
        subject,
        body:         body || "(no body)",
        isNewsletter: isNewsletter(headersMap),
      };

      await callback(data);
    }
  } catch (err) {
    console.error("[imap] Error fetching messages:", err instanceof Error ? err.message : String(err));
  } finally {
    imapProcessing = false;
  }
}

export async function watchImapInbox(
  callback: (data: EmailData) => Promise<void>,
): Promise<void> {
  if (!isImapConfigured()) {
    console.warn("[imap] Not configured — SUPPORT_EMAIL or SUPPORT_PASSWORD missing.");
    return;
  }

  client = new ImapFlow({
    host:   IMAP_HOST,
    port:   IMAP_PORT,
    secure: true, // implicit TLS on port 993
    auth: {
      user: SUPPORT_EMAIL,
      pass: SUPPORT_PASSWORD,
    },
    logger: false,
  });

  await client.connect();
  console.log("[imap] Connected to %s as %s", IMAP_HOST, SUPPORT_EMAIL);

  // Open INBOX with write access (needed to set \Seen flag)
  await client.mailboxOpen("INBOX", { readOnly: false });

  // Drain pre-existing UNSEEN mail — do NOT create tickets for them
  await drainUnreadMessages(client);

  // Catch any mail that arrived during drain
  await fetchAndProcessNewMessages(client, callback);

  // IDLE: server pushes "exists" event when new mail arrives
  client.on("exists", async () => {
    console.log("[imap] EXISTS notification received — fetching new messages");
    await fetchAndProcessNewMessages(client!, callback);
  });

  // Hold connection open indefinitely — resolves when the connection drops
  await new Promise<void>((resolve, reject) => {
    client!.on("close", resolve);
    client!.on("error", reject);
  });
}
