import nodemailer from "nodemailer";

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

function isConfigured(): boolean {
  return !!(GMAIL_USER && GMAIL_APP_PASSWORD);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   "smtp.gmail.com",
      port:   587,
      secure: false, // STARTTLS
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

/* === Microsoft 365 SMTP (commented out — re-enable when IMAP Basic Auth is allowed) ===
const SUPPORT_EMAIL    = process.env.SUPPORT_EMAIL    ?? "";
const SUPPORT_PASSWORD = process.env.SUPPORT_PASSWORD ?? "";
const SMTP_HOST        = process.env.SMTP_HOST        ?? "smtp.office365.com";
const SMTP_PORT        = Number(process.env.SMTP_PORT ?? 587);
=== end M365 SMTP === */

export interface SendReplyEmailOptions {
  to:             string;
  ticketId:       string;
  ticketTitle:    string;
  agentName:      string;
  commentContent: string;
}

export async function sendReplyEmail(opts: SendReplyEmailOptions): Promise<void> {
  const { to, ticketId, ticketTitle, agentName, commentContent } = opts;

  if (!to)             return;
  if (!isConfigured()) return;

  const safeTitle       = ticketTitle.replace(/[\r\n]/g, " ");
  const safeAgentName   = agentName.replace(/[\r\n]/g, " ");
  const safeBody        = commentContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const subject = `[${ticketId}] Re: ${safeTitle}`;
  const text = [
    safeBody,
    "",
    "---",
    `Ticket: ${ticketId}`,
    `This reply was sent by ${safeAgentName} from the support team.`,
    "Please reply to this email or contact support for further assistance.",
  ].join("\n");

  try {
    await getTransporter().sendMail({
      from: GMAIL_USER,
      to,
      subject,
      text,
    });
    console.log(`[mailer] Reply sent for ${ticketId}`);
  } catch (err) {
    console.error(
      "[mailer] Failed to send reply for",
      ticketId,
      ":",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export interface SendPasswordResetEmailOptions {
  to:       string;
  name:     string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(opts: SendPasswordResetEmailOptions): Promise<void> {
  const { to, name, resetUrl } = opts;
  if (!to) return;
  if (!isConfigured()) {
    console.warn("[mailer] Password reset skipped — Gmail not configured");
    return;
  }

  const safeName = name.replace(/[\r\n]/g, " ");
  const text = [
    `Hi ${safeName},`,
    "",
    "You requested a password reset for your Right Tracker Customer Portal account.",
    "",
    "Click the link below to set a new password (valid for 1 hour):",
    resetUrl,
    "",
    "If you did not request this, you can safely ignore this email.",
    "",
    "— Right Tracker Support Team",
  ].join("\n");

  try {
    await getTransporter().sendMail({
      from:    GMAIL_USER,
      to,
      subject: "Reset your Right Tracker password",
      text,
    });
    console.log(`[mailer] Password reset email sent to ${to}`);
  } catch (err) {
    console.error(
      "[mailer] Failed to send password reset email:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ──────────────────────────────────────
// Implementation-request workflow emails
// Each function mirrors the sendReplyEmail pattern:
//   - early return when recipient empty
//   - early return when SMTP not configured
//   - CRLF stripping on user-supplied strings
//   - try/catch around sendMail with console.error (never throws)
// ──────────────────────────────────────

function appBaseUrl(): string {
  return process.env.RIGHT_TRACKER_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:5173";
}

function stripCrlf(s: string): string {
  return s.replace(/[\r\n]/g, " ");
}

function normaliseBody(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export interface SendImplementationRequestSubmittedEmailOptions {
  adminEmail:   string;
  ticketId:     string;
  customerName: string;
  title:        string;
  businessGoal: string;
}

export async function sendImplementationRequestSubmittedEmail(
  opts: SendImplementationRequestSubmittedEmailOptions,
): Promise<void> {
  const { adminEmail, ticketId, customerName, title, businessGoal } = opts;
  if (!adminEmail)     return;
  if (!isConfigured()) return;

  const safeCustomer = stripCrlf(customerName);
  const safeTitle    = stripCrlf(title);
  const safeGoal     = normaliseBody(businessGoal);
  const link         = `${appBaseUrl()}/tickets/${ticketId}`;
  const subject      = `[${ticketId}] New implementation request: ${safeTitle}`;
  const text = [
    `${safeCustomer} submitted a new implementation request.`,
    "",
    `Ticket: ${ticketId}`,
    `Title:  ${safeTitle}`,
    "",
    "Business goal:",
    safeGoal,
    "",
    `Open in admin: ${link}`,
  ].join("\n");

  try {
    await getTransporter().sendMail({
      from: GMAIL_USER,
      to:   adminEmail,
      subject,
      text,
    });
    console.log(`[mailer] Implementation submitted email sent for ${ticketId}`);
  } catch (err) {
    console.error(
      "[mailer] Failed to send implementation submitted email for",
      ticketId,
      ":",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export interface SendImplementationPlanPostedEmailOptions {
  customerEmail: string;
  ticketId:      string;
  customerName:  string;
  title:         string;
}

export async function sendImplementationPlanPostedEmail(
  opts: SendImplementationPlanPostedEmailOptions,
): Promise<void> {
  const { customerEmail, ticketId, customerName, title } = opts;
  if (!customerEmail)  return;
  if (!isConfigured()) return;

  const safeCustomer = stripCrlf(customerName);
  const safeTitle    = stripCrlf(title);
  const link         = `${appBaseUrl()}/portal/tickets/${ticketId}`;
  const subject      = `[${ticketId}] Your implementation plan is ready to review`;
  const text = [
    `Hi ${safeCustomer},`,
    "",
    `Your implementation plan for "${safeTitle}" is ready for review.`,
    "",
    `Review and approve here: ${link}`,
    "",
    "— Right Tracker Support Team",
  ].join("\n");

  try {
    await getTransporter().sendMail({
      from: GMAIL_USER,
      to:   customerEmail,
      subject,
      text,
    });
    console.log(`[mailer] Implementation plan-posted email sent for ${ticketId}`);
  } catch (err) {
    console.error(
      "[mailer] Failed to send implementation plan-posted email for",
      ticketId,
      ":",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export interface SendImplementationApprovedEmailOptions {
  adminEmail:   string;
  ticketId:     string;
  customerName: string;
  title:        string;
}

export async function sendImplementationApprovedEmail(
  opts: SendImplementationApprovedEmailOptions,
): Promise<void> {
  const { adminEmail, ticketId, customerName, title } = opts;
  if (!adminEmail)     return;
  if (!isConfigured()) return;

  const safeCustomer = stripCrlf(customerName);
  const safeTitle    = stripCrlf(title);
  const link         = `${appBaseUrl()}/tickets/${ticketId}`;
  const subject      = `[${ticketId}] Plan approved: ${safeTitle}`;
  const text = [
    `${safeCustomer} approved the plan for "${safeTitle}".`,
    "",
    "You can start implementation.",
    "",
    `Open in admin: ${link}`,
  ].join("\n");

  try {
    await getTransporter().sendMail({
      from: GMAIL_USER,
      to:   adminEmail,
      subject,
      text,
    });
    console.log(`[mailer] Implementation approved email sent for ${ticketId}`);
  } catch (err) {
    console.error(
      "[mailer] Failed to send implementation approved email for",
      ticketId,
      ":",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export interface SendImplementationRejectedEmailOptions {
  adminEmail:   string;
  ticketId:     string;
  customerName: string;
  title:        string;
  reason:       string;
}

export async function sendImplementationRejectedEmail(
  opts: SendImplementationRejectedEmailOptions,
): Promise<void> {
  const { adminEmail, ticketId, customerName, title, reason } = opts;
  if (!adminEmail)     return;
  if (!isConfigured()) return;

  const safeCustomer = stripCrlf(customerName);
  const safeTitle    = stripCrlf(title);
  const safeReason   = normaliseBody(reason);
  const link         = `${appBaseUrl()}/tickets/${ticketId}`;
  const subject      = `[${ticketId}] Plan rejected: ${safeTitle}`;
  const text = [
    `${safeCustomer} rejected the plan for "${safeTitle}".`,
    "",
    "Reason:",
    safeReason,
    "",
    `Open in admin: ${link}`,
  ].join("\n");

  try {
    await getTransporter().sendMail({
      from: GMAIL_USER,
      to:   adminEmail,
      subject,
      text,
    });
    console.log(`[mailer] Implementation rejected email sent for ${ticketId}`);
  } catch (err) {
    console.error(
      "[mailer] Failed to send implementation rejected email for",
      ticketId,
      ":",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export interface SendImplementationMoreInfoRequestedEmailOptions {
  customerEmail: string;
  ticketId:      string;
  customerName:  string;
  title:         string;
  message:       string;
}

export async function sendImplementationMoreInfoRequestedEmail(
  opts: SendImplementationMoreInfoRequestedEmailOptions,
): Promise<void> {
  const { customerEmail, ticketId, customerName, title, message } = opts;
  if (!customerEmail)  return;
  if (!isConfigured()) return;

  const safeCustomer = stripCrlf(customerName);
  const safeTitle    = stripCrlf(title);
  const safeMessage  = normaliseBody(message);
  const link         = `${appBaseUrl()}/portal/tickets/${ticketId}`;
  const subject      = `[${ticketId}] More information needed: ${safeTitle}`;
  const text = [
    `Hi ${safeCustomer},`,
    "",
    `We need more information on your implementation request "${safeTitle}".`,
    "",
    "Message from the support team:",
    safeMessage,
    "",
    `Reply here: ${link}`,
    "",
    "— Right Tracker Support Team",
  ].join("\n");

  try {
    await getTransporter().sendMail({
      from: GMAIL_USER,
      to:   customerEmail,
      subject,
      text,
    });
    console.log(`[mailer] Implementation more-info email sent for ${ticketId}`);
  } catch (err) {
    console.error(
      "[mailer] Failed to send implementation more-info email for",
      ticketId,
      ":",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function sendTicketReopenedEmail(
  to: string,
  ticketId: string,
  ticketTitle: string,
  customerName: string,
  ticketUrl: string,
): Promise<void> {
  if (!isConfigured()) return;
  try {
    const safeTitle = stripCrlf(ticketTitle);
    const safeName  = stripCrlf(customerName);
    const safeUrl   = stripCrlf(ticketUrl);
    await getTransporter().sendMail({
      from:    `"Right Tracker" <${GMAIL_USER}>`,
      to,
      subject: `[${ticketId}] Ticket Reopened by ${safeName}`,
      text:    `${safeName} has reopened ticket ${ticketId}: "${safeTitle}".\n\nView ticket: ${safeUrl}`,
      html:    `<p><strong>${escapeHtml(safeName)}</strong> has reopened ticket <strong>${ticketId}</strong>: "${escapeHtml(safeTitle)}".</p><p><a href="${safeUrl}">View ticket</a></p>`,
    });
    console.log(`[mailer] Ticket reopened email sent for ${ticketId}`);
  } catch (err) {
    console.error("[mailer] sendTicketReopenedEmail error:", err instanceof Error ? err.message : String(err));
  }
}
