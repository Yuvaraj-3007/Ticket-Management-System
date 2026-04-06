import nodemailer from "nodemailer";

const {
  CLOUDMAILIN_SMTP_HOST,
  CLOUDMAILIN_SMTP_PORT,
  CLOUDMAILIN_SMTP_USER,
  CLOUDMAILIN_SMTP_PASS,
  CLOUDMAILIN_FROM_EMAIL,
} = process.env;

function isConfigured(): boolean {
  return !!(
    CLOUDMAILIN_SMTP_HOST &&
    CLOUDMAILIN_SMTP_PORT &&
    CLOUDMAILIN_SMTP_USER &&
    CLOUDMAILIN_SMTP_PASS &&
    CLOUDMAILIN_FROM_EMAIL
  );
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   CLOUDMAILIN_SMTP_HOST,
      port:   Number(CLOUDMAILIN_SMTP_PORT),
      secure: Number(CLOUDMAILIN_SMTP_PORT) === 465,
      auth: {
        user: CLOUDMAILIN_SMTP_USER,
        pass: CLOUDMAILIN_SMTP_PASS,
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
      from: CLOUDMAILIN_FROM_EMAIL,
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
