import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { ROLES } from "@tms/core";

const router = Router();

router.use(requireAuth);

// Block CUSTOMER-role sessions from accessing the agent/admin analytics API
router.use((req, res, next) => {
  const role = (req as any).user?.role;
  if (role !== ROLES.ADMIN && role !== ROLES.AGENT) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  next();
});

// GET /api/analytics/overview
router.get("/overview", async (_req, res) => {
  const [
    total,
    byStatus,
    byType,
    byPriority,
    agentUsers,
    dailyVolume,
    ratingAgg,
    ratingDistribution,
    byClient,
    agentClosedStats,
  ] = await Promise.all([
    // Total ticket count
    prisma.ticket.count(),

    // Count by status
    prisma.ticket.groupBy({ by: ["status"], _count: { id: true } }),

    // Count by type
    prisma.ticket.groupBy({ by: ["type"], _count: { id: true } }),

    // Count by priority
    prisma.ticket.groupBy({ by: ["priority"], _count: { id: true } }),

    // Agent performance: tickets assigned + comments posted
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["ADMIN", "AGENT"] } },
      select: {
        id:   true,
        name: true,
        role: true,
        _count: { select: { assignedTickets: true, comments: true } },
      },
      orderBy: { name: "asc" },
    }),

    // Daily ticket volume for last 30 days
    prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT
        DATE("createdAt") AS date,
        COUNT(*) AS count
      FROM tickets
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,

    // Customer satisfaction aggregate
    prisma.ticket.aggregate({
      where:  { rating: { not: null } },
      _avg:   { rating: true },
      _count: { rating: true },
    }),

    // Rating distribution (1–5 stars)
    prisma.ticket.groupBy({
      by:    ["rating"],
      where: { rating: { not: null } },
      _count: { id: true },
    }),

    // Top clients by ticket count
    prisma.ticket.groupBy({
      by:    ["hrmsClientId", "hrmsClientName"],
      where: { hrmsClientId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),

    // Per-agent closed tickets + avg rating
    prisma.ticket.groupBy({
      by:    ["assignedToId"],
      where: { assignedToId: { not: null }, status: "CLOSED" },
      _count: { id: true },
      _avg:   { rating: true },
    }),
  ]);

  // Avg resolution time and by-priority breakdown (CLOSED tickets)
  const closedTickets = await prisma.ticket.findMany({
    where:  { status: "CLOSED" },
    select: { createdAt: true, updatedAt: true, priority: true },
  });

  const avgResolutionHours =
    closedTickets.length > 0
      ? closedTickets.reduce(
          (sum, t) =>
            sum + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()),
          0
        ) /
        closedTickets.length /
        (1000 * 60 * 60)
      : null;

  // Avg resolution hours per priority
  const priorityResMap = new Map<string, { sum: number; count: number }>();
  for (const t of closedTickets) {
    const entry = priorityResMap.get(t.priority) ?? { sum: 0, count: 0 };
    entry.sum +=
      new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
    entry.count += 1;
    priorityResMap.set(t.priority, entry);
  }
  const avgResolutionByPriority = Array.from(priorityResMap.entries()).map(
    ([priority, { sum, count }]) => ({
      priority,
      avgHours: Math.round((sum / count / (1000 * 60 * 60)) * 10) / 10,
    })
  );

  // Build agent stats with closed tickets and avg rating
  const closedMap = new Map(
    agentClosedStats.map((r) => [
      r.assignedToId!,
      { count: r._count.id, avgRating: r._avg.rating },
    ])
  );
  const agentStats = agentUsers.map((a) => ({
    id:              a.id,
    name:            a.name,
    role:            a.role,
    assignedTickets: a._count.assignedTickets,
    commentsMade:    a._count.comments,
    closedTickets:   closedMap.get(a.id)?.count ?? 0,
    avgRating:
      closedMap.get(a.id)?.avgRating != null
        ? Math.round(closedMap.get(a.id)!.avgRating! * 10) / 10
        : null,
  }));

  res.json({
    total,
    byStatus:   byStatus.map((s) => ({ status: s.status, count: s._count.id })),
    byType:     byType.map((t) => ({ type: t.type, count: t._count.id })),
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count.id })),
    agentStats,
    dailyVolume: dailyVolume.map((d) => ({ date: d.date, count: Number(d.count) })),
    avgResolutionHours:
      avgResolutionHours !== null
        ? Math.round(avgResolutionHours * 10) / 10
        : null,
    avgRating:
      ratingAgg._avg.rating != null
        ? Math.round(ratingAgg._avg.rating * 10) / 10
        : null,
    ratedCount: ratingAgg._count.rating,
    ratingDistribution: [1, 2, 3, 4, 5].map((stars) => ({
      stars,
      count:
        ratingDistribution.find((r) => r.rating === stars)?._count.id ?? 0,
    })),
    byClient: byClient
      .slice(0, 8)
      .map((c) => ({
        clientId:   c.hrmsClientId!,
        clientName: c.hrmsClientName ?? c.hrmsClientId!,
        count:      c._count.id,
      })),
    avgResolutionByPriority,
  });
});

export default router;
