// A paired phone scanner, as the PC sees it right after creating it. `token` is shown once (in the QR).
export interface ScanSessionCreatedDto {
  id: string;
  token: string;
  expiresAt: Date;
}

export interface ScanEventDto {
  id: string; // bigint as a string: the PC's poll cursor
  code: string;
}

export interface ScanPollDto {
  scans: ScanEventDto[];
  phoneConnected: boolean;
  closed: boolean;
}

// What the phone shows after pairing.
export interface ScanSessionInfoDto {
  shopName: string;
  branchName: string;
}

// What the phone shows after each scan.
export interface ScanResultDto {
  found: boolean;
  name: string | null;
  salePrice: string | null;
}

export interface ScanSessionRow {
  id: string;
  businessId: string;
  branchId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  closedAt: Date | null;
  phoneSeenAt: Date | null;
}

export interface CreateScanSessionData {
  businessId: string;
  branchId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}
