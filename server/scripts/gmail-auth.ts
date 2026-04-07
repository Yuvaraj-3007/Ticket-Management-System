/**
 * One-time OAuth2 token generation script.
 * Run once to obtain GOOGLE_REFRESH_TOKEN, then add it to server/.env
 *
 * Usage:
 *   cd server
 *   bun run scripts/gmail-auth.ts
 */
import { google } from "googleapis";
import http from "http";
import dotenv from "dotenv";

dotenv.config();

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

const REDIRECT_URI = "http://localhost:3456/oauth2callback";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI,
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
});

console.log("\n=== Gmail OAuth2 Token Generator ===\n");
console.log("1. Visit this URL in your browser:\n");
console.log(authUrl + "\n");
console.log("2. Sign in and allow access.");
console.log("3. You will be redirected to localhost — the token will be printed here automatically.\n");

// Start a temporary local server to capture the OAuth2 callback
const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) return;

  const url = new URL(req.url, "http://localhost:3456");
  const code = url.searchParams.get("code");

  if (!code) {
    res.end("No code received.");
    server.close();
    return;
  }

  res.end("<h2>✅ Authorisation successful! You can close this tab.</h2>");
  server.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("✅ Success! Add this to your server/.env:\n");
    console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("\nDone.");
  } catch (err) {
    console.error("❌ Failed to exchange code:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
});

server.listen(3456, () => {
  console.log("Waiting for Google to redirect to localhost:3456...\n");
});
