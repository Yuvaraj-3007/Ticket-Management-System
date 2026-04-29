import { PgBoss } from "pg-boss";

// Append keepAlives=true to the connection string so the pg driver sends
// TCP keepalive probes. Without it, the PostgreSQL server closes idle
// connections and pg-boss throws "Connection terminated unexpectedly".
const rawUrl = process.env.DATABASE_URL!;
const connectionString = rawUrl.includes("?")
  ? `${rawUrl}&keepAlives=true`
  : `${rawUrl}?keepAlives=true`;

const boss = new PgBoss({
  connectionString,
  // Limit pool size — the default (10) overwhelms small remote DBs and
  // causes "Connection terminated due to connection timeout" errors.
  max: 3,
  // Check job state every 30s instead of the default (to reduce DB chatter).
  monitorIntervalSeconds: 30,
  // Label connections so they're identifiable in pg_stat_activity.
  application_name: "tms-boss",
});

export default boss;
