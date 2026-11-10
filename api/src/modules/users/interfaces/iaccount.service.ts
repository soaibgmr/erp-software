import type { RegisterDto } from "../user.types";

// Self-service account flows that run before the user is signed in.
export interface IAccountService {
  // Creates a PENDING shop with its owner. The owner can log in once the platform admin approves it.
  register(input: RegisterDto, ip?: string): Promise<{ status: "PENDING" }>;
  // Always succeeds, so the response never reveals whether an account exists.
  forgotPassword(identifier: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
}
