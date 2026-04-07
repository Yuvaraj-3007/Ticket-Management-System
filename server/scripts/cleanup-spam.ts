import prisma from "../src/lib/prisma.js";

// Delete tickets from known automated/newsletter senders.
// Add more patterns here as needed — do NOT hardcode personal email addresses.
const spamPatterns = [
  "linkedin.com",
  "moonshot.ai",
  "aioseo.com",
  "wordpress.com",
  "googleplay",
  "mailer.jio",
  "link-assistant.com",
  "pinterest.com",
  "discover.pinterest.com",
  "clustersconnects",
  "noreply",
  "no-reply",
];

const result = await prisma.ticket.deleteMany({
  where: {
    OR: spamPatterns.map((pattern) => ({
      senderEmail: { contains: pattern },
    })),
  },
});

console.log(`Deleted ${result.count} spam tickets`);
await prisma.$disconnect();
