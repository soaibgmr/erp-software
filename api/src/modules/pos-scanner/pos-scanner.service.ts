import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { inject, injectable } from "inversify";
import { TYPES } from "../../config/ioc.types";
import type { AuthContext } from "../../common/auth-context";
import { HttpError, notFound, unauthorized } from "../../common/http-error";
import { assertBusinessActive } from "../../common/tenant";
import type { IItemRepository } from "../items/interfaces/iitem.repository";
import type { IPosScannerRepository } from "./interfaces/ipos-scanner.repository";
import type { IPosScannerService } from "./interfaces/ipos-scanner.service";
import type {
  ScanPollDto,
  ScanResultDto,
  ScanSessionCreatedDto,
  ScanSessionInfoDto,
  ScanSessionRow,
} from "./pos-scanner.types";

const HOUR = 60 * 60 * 1000;
export const SCAN_SESSION_TTL_MS = 12 * HOUR;
const CLEANUP_AFTER_MS = 24 * HOUR;
const POLL_LIMIT = 50;
// The phone counts as connected while it has pinged or scanned within this window.
const PHONE_ONLINE_MS = 2 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const sessionEnded = () =>
  new HttpError(410, "SCAN_SESSION_ENDED", "This phone scanner was ended on the counter PC. Scan a new QR code.");

@injectable()
export class PosScannerService implements IPosScannerService {
  constructor(
    @inject(TYPES.PosScannerRepository) private readonly repo: IPosScannerRepository,
    @inject(TYPES.ItemRepository) private readonly items: IItemRepository,
  ) {}

  async create(auth: AuthContext, branchId: string): Promise<ScanSessionCreatedDto> {
    const now = new Date();
    await this.repo.deleteExpired(new Date(now.getTime() - CLEANUP_AFTER_MS));
    await this.repo.closeOpenFor(auth.userId, branchId, now);
    const token = randomBytes(24).toString("base64url");
    const session = await this.repo.create({
      businessId: auth.businessId,
      branchId,
      userId: auth.userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + SCAN_SESSION_TTL_MS),
    });
    return { id: session.id, token, expiresAt: session.expiresAt };
  }

  async poll(auth: AuthContext, id: string, after: string | undefined): Promise<ScanPollDto> {
    const session = await this.ownSession(auth, id);
    const now = Date.now();
    const closed = session.closedAt !== null || session.expiresAt.getTime() <= now;
    const scans = closed ? [] : await this.repo.listScans(id, after ? BigInt(after) : null, POLL_LIMIT);
    const phoneConnected =
      !closed && session.phoneSeenAt !== null && now - session.phoneSeenAt.getTime() < PHONE_ONLINE_MS;
    return { scans, phoneConnected, closed };
  }

  async end(auth: AuthContext, id: string): Promise<void> {
    await this.ownSession(auth, id);
    await this.repo.close(id, new Date());
  }

  async ping(id: string, token: string | undefined): Promise<ScanSessionInfoDto> {
    const session = await this.phoneSession(id, token);
    const info = await this.repo.findShopInfo(session.businessId, session.branchId);
    if (!info) throw sessionEnded();
    assertBusinessActive(info.status);
    await this.repo.markPhoneSeen(id, new Date());
    return { shopName: info.shopName, branchName: info.branchName };
  }

  async scan(id: string, token: string | undefined, code: string): Promise<ScanResultDto> {
    const session = await this.phoneSession(id, token);
    await this.repo.addScan(id, code, new Date());
    const item = await this.items.findByCode(session.businessId, code, session.branchId);
    return { found: item !== null, name: item?.name ?? null, salePrice: item?.salePrice ?? null };
  }

  // The PC may only see its own user's sessions in its own business.
  private async ownSession(auth: AuthContext, id: string): Promise<ScanSessionRow> {
    const session = await this.repo.findById(id);
    if (!session || session.businessId !== auth.businessId || session.userId !== auth.userId) {
      throw notFound("Phone scanner not found");
    }
    return session;
  }

  // The phone proves itself with the token from the QR code.
  private async phoneSession(id: string, token: string | undefined): Promise<ScanSessionRow> {
    const session = await this.repo.findById(id);
    if (!session || !token || !sameHash(session.tokenHash, hashToken(token))) {
      throw unauthorized("This scanner link is not valid. Scan the QR code on the counter PC again.");
    }
    if (session.closedAt !== null || session.expiresAt.getTime() <= Date.now()) throw sessionEnded();
    return session;
  }
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
