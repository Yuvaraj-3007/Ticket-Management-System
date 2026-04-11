import type { Job } from "pg-boss";
import boss from "../lib/boss.js";
import prisma from "../lib/prisma.js";
import { getEmployeeDirectory } from "../lib/hrms.js";
import { ROLES } from "@tms/core";

export interface SyncResult {
  skipped: boolean;
  deactivated: string[];
  reactivated: string[];
}

export const SYNC_HRMS_QUEUE = "sync-hrms-employees";

export async function runHrmsSync(): Promise<SyncResult> {
  // Safety: skip if HRMS not configured
  if (!process.env.HRMS_API_URL) {
    return { skipped: true, deactivated: [], reactivated: [] };
  }

  const hrmsEmployees = await getEmployeeDirectory();

  // Safety: if empty list returned (HRMS down or auth failed), skip to avoid mass-deactivation
  if (hrmsEmployees.length === 0) {
    console.warn("[sync-hrms] Employee directory returned empty — skipping sync to avoid mass-deactivation");
    return { skipped: true, deactivated: [], reactivated: [] };
  }

  const activeHrmsEmails = new Set(hrmsEmployees.map((e) => e.email.toLowerCase()));

  // System accounts that are not HRMS employees and must never be deactivated by sync
  const SYSTEM_EMAILS = new Set(["ai@system.internal"]);

  const agentUsers = await prisma.user.findMany({
    where: { role: ROLES.AGENT },
    select: { id: true, email: true, isActive: true },
  });

  const toDeactivate = agentUsers.filter(
    (u) =>
      u.isActive &&
      !activeHrmsEmails.has(u.email.toLowerCase()) &&
      !SYSTEM_EMAILS.has(u.email.toLowerCase()),
  );
  const toReactivate = agentUsers.filter(
    (u) => !u.isActive && activeHrmsEmails.has(u.email.toLowerCase()),
  );

  if (toDeactivate.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: toDeactivate.map((u) => u.id) } },
      data: { isActive: false },
    });
  }
  if (toReactivate.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: toReactivate.map((u) => u.id) } },
      data: { isActive: true },
    });
  }

  const result: SyncResult = {
    skipped: false,
    deactivated: toDeactivate.map((u) => u.email),
    reactivated: toReactivate.map((u) => u.email),
  };
  console.log(
    `[sync-hrms] Sync complete — deactivated: ${result.deactivated.length}, reactivated: ${result.reactivated.length}`,
  );
  return result;
}

export async function registerSyncHrmsWorker(): Promise<void> {
  await boss.createQueue(SYNC_HRMS_QUEUE);
  await boss.work<Record<string, never>>(
    SYNC_HRMS_QUEUE,
    { batchSize: 1 },
    async (jobs: Job<Record<string, never>>[]) => {
      await Promise.all(jobs.map(() => runHrmsSync()));
    },
  );
}
