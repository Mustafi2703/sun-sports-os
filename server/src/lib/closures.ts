import { prisma } from "./prisma.js";

export function mapClosure(c: {
  id: string;
  date: Date;
  title: string;
  reason: string | null;
  type: string;
  scope: string;
  batchId: string;
  createdById: string | null;
}) {
  return {
    id: c.id,
    date: c.date.toISOString().slice(0, 10),
    title: c.title,
    reason: c.reason || "",
    type: c.type,
    scope: c.scope,
    batchId: c.batchId || null,
    createdById: c.createdById || null,
  };
}

export async function listClosures(opts?: {
  from?: Date;
  to?: Date;
  batchId?: string | null;
}) {
  const from = opts?.from;
  const to = opts?.to;
  const rows = await prisma.academyClosure.findMany({
    where: {
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      OR: [
        { scope: "academy" },
        ...(opts?.batchId
          ? [{ scope: "batch", batchId: opts.batchId }]
          : [{ scope: "batch" }]),
      ],
    },
    orderBy: { date: "asc" },
    take: 200,
  });
  return rows.map(mapClosure);
}
