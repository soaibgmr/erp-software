import type { PrismaClient } from "@prisma/client";

export type UserRef = { id: string; name: string };

// "Created by" columns hold bare user ids; this resolves them to display names in one query.
export async function loadUserNames(
  prisma: PrismaClient,
  ids: (string | null | undefined)[],
): Promise<Map<string, UserRef>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, firstName: true, lastName: true },
  });
  return new Map(users.map((u) => [u.id, { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }]));
}
