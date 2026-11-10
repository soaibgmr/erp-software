import { Prisma, type PrismaClient } from "@prisma/client";

// A repository method that may run inside a caller's transaction accepts `db?: Db`.
export type Db = PrismaClient | Prisma.TransactionClient;

// Unique-constraint violation (P2002), e.g. two requests racing on the same idempotency key.
export const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
