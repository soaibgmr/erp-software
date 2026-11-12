import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { HttpError } from "../common/http-error";
import { authFor, ids, stub } from "../test/fakes";
import type { IItemRepository } from "./items/interfaces/iitem.repository";
import type { ItemSearchResultDto } from "./items/item.types";
import type { IPosScannerRepository } from "./pos-scanner/interfaces/ipos-scanner.repository";
import { PosScannerService } from "./pos-scanner/pos-scanner.service";
import type { ScanSessionRow } from "./pos-scanner/pos-scanner.types";

// In-memory sessions and scans, enough for the service rules.
function fakeRepo() {
  const sessions = new Map<string, ScanSessionRow>();
  const scans: { id: bigint; sessionId: string; code: string }[] = [];
  let next = 1n;
  let n = 0;
  const repo: IPosScannerRepository = {
    async create(data) {
      const row = { ...data, id: `40000000-0000-4000-8000-00000000000${++n}`, closedAt: null, phoneSeenAt: null };
      sessions.set(row.id, row);
      return row;
    },
    async findById(id) {
      return sessions.get(id) ?? null;
    },
    async closeOpenFor(userId, branchId, now) {
      for (const s of sessions.values())
        if (s.userId === userId && s.branchId === branchId && !s.closedAt) s.closedAt = now;
    },
    async close(id, now) {
      const s = sessions.get(id);
      if (s && !s.closedAt) s.closedAt = now;
    },
    async markPhoneSeen(id, now) {
      sessions.get(id)!.phoneSeenAt = now;
    },
    async deleteExpired() {
      return 0;
    },
    async addScan(sessionId, code, now) {
      scans.push({ id: next++, sessionId, code });
      sessions.get(sessionId)!.phoneSeenAt = now;
    },
    async listScans(sessionId, after, limit) {
      return scans
        .filter((s) => s.sessionId === sessionId && (after === null || s.id > after))
        .slice(0, limit)
        .map((s) => ({ id: s.id.toString(), code: s.code }));
    },
    async findShopInfo() {
      return { shopName: "Sharma Auto", branchName: "Main", status: "ACTIVE" as const };
    },
  };
  return { repo, sessions };
}

const items = stub<IItemRepository>({
  async findByCode(businessId: string, code: string) {
    return businessId === ids.business && code === "8901234567890"
      ? ({ name: "Brake pad", salePrice: "450.00" } as ItemSearchResultDto)
      : null;
  },
});

async function setup() {
  const { repo, sessions } = fakeRepo();
  const svc = new PosScannerService(repo, items);
  const auth = authFor("counter");
  const created = await svc.create(auth, ids.branchA);
  return { svc, auth, created, sessions };
}

const status = (p: Promise<unknown>) =>
  p.then(
    () => 200,
    (e: HttpError) => e.status,
  );

describe("PosScannerService", () => {
  it("passes phone scans to the PC in order, after the cursor", async () => {
    const { svc, auth, created } = await setup();
    expect(await svc.ping(created.id, created.token)).toEqual({ shopName: "Sharma Auto", branchName: "Main" });

    expect(await svc.scan(created.id, created.token, "8901234567890")).toEqual({
      found: true,
      name: "Brake pad",
      salePrice: "450.00",
    });
    expect((await svc.scan(created.id, created.token, "000")).found).toBe(false);

    const first = await svc.poll(auth, created.id, undefined);
    expect(first.scans.map((s) => s.code)).toEqual(["8901234567890", "000"]);
    expect(first.phoneConnected).toBe(true);
    expect((await svc.poll(auth, created.id, first.scans[0]!.id)).scans.map((s) => s.code)).toEqual(["000"]);
    expect((await svc.poll(auth, created.id, first.scans[1]!.id)).scans).toEqual([]);
  });

  it("stores only a hash of the token and refuses a wrong or missing token", async () => {
    const { svc, created, sessions } = await setup();
    expect(sessions.get(created.id)!.tokenHash).not.toContain(created.token);
    expect(await status(svc.scan(created.id, "wrong", "123"))).toBe(401);
    expect(await status(svc.scan(created.id, undefined, "123"))).toBe(401);
    expect(await status(svc.ping("40000000-0000-4000-8000-000000000099", created.token))).toBe(401);
  });

  it("refuses scans once the PC ends the scanner, or a new one replaces it", async () => {
    const { svc, auth, created } = await setup();
    const second = await svc.create(auth, ids.branchA);
    expect(await status(svc.scan(created.id, created.token, "123"))).toBe(410);
    expect((await svc.poll(auth, created.id, undefined)).closed).toBe(true);

    await svc.end(auth, second.id);
    expect(await status(svc.scan(second.id, second.token, "123"))).toBe(410);
  });

  it("refuses expired scanners", async () => {
    const { svc, created, sessions } = await setup();
    sessions.get(created.id)!.expiresAt = new Date(Date.now() - 1000);
    expect(await status(svc.ping(created.id, created.token))).toBe(410);
  });

  it("hides a scanner from other users and other shops", async () => {
    const { svc, created } = await setup();
    expect(await status(svc.poll(authFor("manager"), created.id, undefined))).toBe(404);
    const otherShop = { ...authFor("counter"), businessId: ids.otherBusiness };
    expect(await status(svc.poll(otherShop, created.id, undefined))).toBe(404);
    expect(await status(svc.end(otherShop, created.id))).toBe(404);
  });
});
