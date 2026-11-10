import "reflect-metadata";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { logger } from "./config/logger";
import app from "./app";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main() {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, timezone: env.APP_TIMEZONE }, "Server running");
  });

  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");

    const forceExit = setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async (err) => {
      if (err) logger.error({ err }, "Error closing HTTP server");
      try {
        await disconnectDatabase();
        process.exit(err ? 1 : 0);
      } catch (dbErr) {
        logger.error({ err: dbErr }, "Error disconnecting database");
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled rejection");
  process.exit(1);
});

main().catch(async (err) => {
  logger.fatal({ err }, "Failed to start server");
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
