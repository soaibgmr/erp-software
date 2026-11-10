import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env, isProduction } from "./env";
import { logger } from "./logger";
import { resolveSslRootCert } from "./database-url";

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: resolveSslRootCert(env.DATABASE_URL),
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
    statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  });

  const client = new PrismaClient({
    adapter,
    log: isProduction
      ? [
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" },
        ]
      : [
          { emit: "event", level: "query" },
          { emit: "event", level: "warn" },
          { emit: "event", level: "error" },
        ],
  });

  client.$on("warn", (e) => logger.warn({ prisma: e.message }, "prisma warning"));
  client.$on("error", (e) => logger.error({ prisma: e.message }, "prisma error"));
  if (!isProduction) {
    client.$on("query", (e) => logger.trace({ durationMs: e.duration, query: e.query }, "prisma query"));
  }

  return client;
}

// Reuse one client across hot reloads in development to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) globalForPrisma.prisma = prisma;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  logger.info("Database connected");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Database disconnected");
}
