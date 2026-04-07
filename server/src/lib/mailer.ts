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

  const safeTitle     = ticketTitle.replace(/[\r\n]/g, " ");
  const safeAgentName = agentName.replace(/[\r\n]/g, " ");
  const subject = `Re: ${safeTitle}`;
  const text = [
    commentContent,
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
