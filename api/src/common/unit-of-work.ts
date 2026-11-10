import { inject, injectable } from "inversify";
import { PrismaClient } from "@prisma/client";
import { TYPES } from "../config/ioc.types";
import type { Db } from "./prisma-types";

// Transaction boundary for services: everything done with `tx` commits or rolls back together.
// Services depend on this port instead of Prisma, so tests can run the callback with a fake client.
export interface IUnitOfWork {
  run<T>(work: (tx: Db) => Promise<T>, options?: { timeoutMs?: number }): Promise<T>;
}

@injectable()
export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  run<T>(work: (tx: Db) => Promise<T>, { timeoutMs = 20_000 } = {}): Promise<T> {
    return this.prisma.$transaction((tx) => work(tx), {
      isolationLevel: "ReadCommitted",
      timeout: timeoutMs,
      maxWait: 10_000,
    });
  }
}
