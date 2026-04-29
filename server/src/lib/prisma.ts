import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep TCP connections alive so the remote DB does not silently drop idle
  // connections overnight → prevents Better Auth hanging → 502.
  keepAlive: true,
  // Cap pool size so we don't exhaust PostgreSQL's max_connections at startup.
  max: 5,
  // Release idle connections after 30 s to avoid stale socket errors.
  idleTimeoutMillis: 30_000,
  // Fail fast if the DB is unreachable (default is no timeout).
  connectionTimeoutMillis: 10_000,
});

// Surface idle-client errors to logs instead of letting them become
// unhandled 'error' events that previously crashed the process.
pool.on("error", (err) => {
  console.error("[prisma-pool] idle client error:", err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
