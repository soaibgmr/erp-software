import type { BusinessStatus } from "@prisma/client";
import type { CreateScanSessionData, ScanEventDto, ScanSessionRow } from "../pos-scanner.types";

export interface IPosScannerRepository {
  create(data: CreateScanSessionData): Promise<ScanSessionRow>;
  findById(id: string): Promise<ScanSessionRow | null>;
  /** Closes the user's open sessions in a branch (a PC has one phone scanner at a time). */
  closeOpenFor(userId: string, branchId: string, now: Date): Promise<void>;
  close(id: string, now: Date): Promise<void>;
  markPhoneSeen(id: string, now: Date): Promise<void>;
  /** Hard-deletes sessions (and their scans) that expired before `before`. */
  deleteExpired(before: Date): Promise<number>;
  addScan(sessionId: string, code: string, now: Date): Promise<void>;
  listScans(sessionId: string, after: bigint | null, limit: number): Promise<ScanEventDto[]>;
  /** Shop and branch names, plus the shop's status, for the phone. */
  findShopInfo(
    businessId: string,
    branchId: string,
  ): Promise<{ shopName: string; branchName: string; status: BusinessStatus } | null>;
}
