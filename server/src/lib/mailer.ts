import nodemailer from "nodemailer";

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

function isConfigured(): boolean {
  return !!(GMAIL_USER && GMAIL_APP_PASSWORD);
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
  const subject = `Re: ${safeTitle}`;
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
