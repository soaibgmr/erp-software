import "reflect-metadata";
import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { demoRequestSchema } from "@erp-software/shared";
import { env } from "../config/env";
import type { BusinessStatus } from "@prisma/client";
import { HttpError } from "../common/http-error";
import { resolveBranchScope } from "../common/branch-scope";
import { PLATFORM_AUDIENCE } from "../common/tenant";
import type { IUnitOfWork } from "../common/unit-of-work";
import { AuthMiddleware } from "../middleware/auth";
import { authFor, branch, FakeAudit, FakeLimiter, ids, stub } from "../test/fakes";
import { CustomerService } from "./customers/customer.service";
import { UserService } from "./users/user.service";
import { AccountService } from "./users/account.service";
import { PlatformService } from "./platform/platform.service";
import type { IBranchRepository } from "./branches/interfaces/ibranch.repository";
import type { IBusinessRepository } from "./business/interfaces/ibusiness.repository";
import type { ICustomerRepository } from "./customers/interfaces/icustomer.repository";
import type { CustomerResponseDto } from "./customers/customer.types";
import type { IMailService } from "./mail/interfaces/imail.service";
import type { MailMessage } from "./mail/mail.types";
import type { IPlatformRepository } from "./platform/interfaces/iplatform.repository";
import type { PlatformBusinessDto } from "./platform/platform.types";
import type { IRoleRepository } from "./roles/interfaces/irole.repository";
import type { IAuthTokenRepository } from "./users/interfaces/iauth-token.repository";
import type { IRefreshTokenRepository } from "./users/interfaces/irefresh-token.repository";
import type { IUserRepository } from "./users/interfaces/iuser.repository";

async function expectHttp(promise: Promise<unknown>, status: number, code?: string): Promise<HttpError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
  if (code) expect((err as HttpError).code).toBe(code);
  return err as HttpError;
}

class FakeMail implements IMailService {
  sent: MailMessage[] = [];
  async send(m: MailMessage) {
    this.sent.push(m);
  }
  async sendQuietly(m: MailMessage) {
    this.sent.push(m);
  }
}

describe("Company data stays separate", () => {
  it("a branch of another company is out of scope, even for an owner", async () => {
    // Owners' branchIds hold only their own company's branches (filled by AuthMiddleware).
    const owner = authFor("owner", [ids.branchA]);
    const branches = stub<IBranchRepository>({ findById: async (_b, id) => branch(id) });
    await expectHttp(resolveBranchScope(branches, owner, ids.branchB, undefined), 403);
  });

  it('"all branches" lists only the company\'s own branches', async () => {
    let seen: string | undefined;
    const branches = stub<IBranchRepository>({
      list: async (businessId) => {
        seen = businessId;
        return [branch(ids.branchA)];
      },
    });
    const scope = await resolveBranchScope(branches, authFor("owner"), "all", undefined);
    expect(seen).toBe(ids.business);
    expect(scope.businessId).toBe(ids.business);
    expect(scope.branchIds).toEqual([ids.branchA]);
  });

  it("another company's customer is not found", async () => {
    const theirs = { id: "40000000-0000-4000-8000-000000000001", name: "Other shop's customer" } as CustomerResponseDto;
    const repo = stub<ICustomerRepository>({
      // The repository only returns rows of the business it is asked about.
      findById: async (businessId, id) => (businessId === ids.otherBusiness && id === theirs.id ? theirs : null),
    });
    const svc = new CustomerService(repo, new FakeAudit());
    await expectHttp(svc.getById(authFor("owner"), theirs.id), 404);
  });

  it("the same customer mobile can exist in two companies", async () => {
    let checkedIn: string | undefined;
    const repo = stub<ICustomerRepository>({
      findByMobile: async (businessId) => {
        checkedIn = businessId;
        return null;
      },
      create: async (_b, data) => ({ id: "new", ...data }) as unknown as CustomerResponseDto,
    });
    const svc = new CustomerService(repo, new FakeAudit());
    await svc.create(authFor("owner"), {
      type: "RETAIL",
      name: "Ramesh",
      mobile: "9876543210",
      creditLimit: 0,
      creditDays: 0,
    } as never);
    expect(checkedIn).toBe(ids.business);
  });
});

describe("Login and shop status", () => {
  function login(status: BusinessStatus, password = "right-password", limiter = new FakeLimiter()) {
    const hash = bcrypt.hashSync("right-password", 4);
    const users = stub<IUserRepository>({
      findCredentialsByIdentifier: async (identifier) =>
        identifier === "9876543210"
          ? { id: ids.owner, status: "ACTIVE", passwordHash: hash, businessId: ids.business, businessStatus: status }
          : null,
      touchLastLogin: async () => {},
      findById: async () => ({ id: ids.owner }) as never,
    });
    const tokens = stub<IRefreshTokenRepository>({ create: async () => {} });
    const svc = new UserService(
      users,
      tokens,
      stub<IRoleRepository>({}),
      stub<IBranchRepository>({}),
      stub<IBusinessRepository>({}),
      new FakeAudit(),
      limiter,
    );
    return svc.login({ identifier: "9876543210", password });
  }

  it("an active shop's owner gets tokens", async () => {
    const res = await login("ACTIVE");
    expect(res.token).toBeTruthy();
    expect(res.refreshToken).toBeTruthy();
  });

  it("a shop waiting for approval can't log in yet", async () => {
    await expectHttp(login("PENDING"), 403, "BUSINESS_PENDING");
  });

  it("a suspended or rejected shop can't log in", async () => {
    await expectHttp(login("SUSPENDED"), 403, "BUSINESS_SUSPENDED");
    await expectHttp(login("REJECTED"), 403, "BUSINESS_REJECTED");
  });

  it("locks the account after 8 wrong passwords, even for the right one", async () => {
    const limiter = new FakeLimiter();
    for (let i = 0; i < 8; i++) await expectHttp(login("ACTIVE", `guess-${i}`, limiter), 401);
    await expectHttp(login("ACTIVE", "right-password", limiter), 429);
  });

  it("a successful sign-in clears earlier failures", async () => {
    const limiter = new FakeLimiter();
    for (let i = 0; i < 7; i++) await expectHttp(login("ACTIVE", `guess-${i}`, limiter), 401);
    await login("ACTIVE", "right-password", limiter);
    expect(limiter.counts.size).toBe(0);
  });

  it("a wrong password never reveals the shop's status", async () => {
    await expectHttp(login("PENDING", "wrong"), 401);
  });
});

describe("Token audiences", () => {
  const middleware = new AuthMiddleware(
    stub<IUserRepository>({ findAuthUser: async () => null }),
    stub<IBranchRepository>({}),
  );
  const run = (token: string) =>
    middleware.requireAuth(
      { headers: { authorization: `Bearer ${token}` } } as never,
      { locals: {} } as never,
      () => {},
    );

  it("a platform-admin token can't open shop data", async () => {
    const token = jwt.sign({}, "test-secret-test-secret-test-secret-123", {
      subject: ids.owner,
      audience: PLATFORM_AUDIENCE,
    });
    await expectHttp(
      Promise.resolve().then(() => run(token)),
      401,
    );
  });
});

describe("AccountService", () => {
  const uow: IUnitOfWork = {
    run: async (work) =>
      work({
        business: { create: async () => ({ id: ids.business }) },
        role: { createMany: async () => ({ count: 5 }), findUniqueOrThrow: async () => ({ id: ids.ownerRole }) },
        branch: { create: async () => ({ id: ids.branchA }) },
        user: { create: async () => ({ id: ids.owner }) },
      } as never),
  };

  function accounts(opts: { mobileTaken?: boolean; consumed?: string | null } = {}) {
    const mail = new FakeMail();
    const state = { passwordChanged: false, sessionsEnded: false };
    const users = stub<IUserRepository>({
      existsByMobile: async () => opts.mobileTaken ?? false,
      existsByEmail: async () => false,
      findContactByIdentifier: async (identifier) =>
        identifier === "9876543210"
          ? { id: ids.owner, firstName: "Ravi", email: "ravi@shop.in", businessId: ids.business }
          : null,
      findContactById: async () => ({
        id: ids.owner,
        firstName: "Ravi",
        email: "ravi@shop.in",
        businessId: ids.business,
      }),
      updatePasswordHash: async () => {
        state.passwordChanged = true;
        return true;
      },
      markEmailVerified: async () => {},
    });
    const tokens = stub<IAuthTokenRepository>({
      invalidateAll: async () => {},
      create: async () => {},
      consume: async () => (opts.consumed === undefined ? ids.owner : opts.consumed),
    });
    const refresh = stub<IRefreshTokenRepository>({
      revokeAllForUser: async () => {
        state.sessionsEnded = true;
      },
    });
    const svc = new AccountService(users, tokens, refresh, uow, mail, new FakeAudit());
    return { svc, mail, state };
  }

  const shop = {
    shopName: "Ravi Auto Parts",
    city: "Kochi",
    stateCode: "32",
    gstin: null,
    ownerFirstName: "Ravi",
    ownerLastName: "K",
    mobile: "9876543210",
    email: "ravi@shop.in",
    password: "password-1",
  };

  it("registers a shop as waiting for approval and emails the owner", async () => {
    const { svc, mail } = accounts();
    expect(await svc.register(shop)).toEqual({ status: "PENDING" });
    expect(mail.sent[0]!.to).toBe("ravi@shop.in");
    expect(mail.sent[0]!.html).toContain("/verify-email?token=");
  });

  it("refuses a mobile number that already has an account", async () => {
    const { svc } = accounts({ mobileTaken: true });
    const err = await expectHttp(svc.register(shop), 400);
    expect((err.details as { fieldErrors: Record<string, string[]> }).fieldErrors.mobile).toBeDefined();
  });

  it("sends a reset link only when the account has an email, and says nothing either way", async () => {
    const { svc, mail } = accounts();
    await svc.forgotPassword("9999999999");
    expect(mail.sent).toHaveLength(0);
    await svc.forgotPassword("9876543210");
    expect(mail.sent[0]!.html).toContain("/reset-password?token=");
  });

  it("a used or expired reset link is refused", async () => {
    const { svc } = accounts({ consumed: null });
    await expectHttp(svc.resetPassword("x".repeat(40), "new-password-1"), 400);
  });

  it("resetting the password signs out every session", async () => {
    const { svc, state } = accounts();
    await svc.resetPassword("x".repeat(40), "new-password-1");
    expect(state.passwordChanged).toBe(true);
    expect(state.sessionsEnded).toBe(true);
  });
});

describe("PlatformService", () => {
  const pending: PlatformBusinessDto = {
    id: ids.business,
    name: "Ravi Auto Parts",
    legalName: "Ravi Auto Parts",
    city: "Kochi",
    stateCode: "32",
    gstin: null,
    status: "PENDING",
    statusNote: null,
    approvedAt: null,
    createdAt: new Date(),
    owner: { name: "Ravi K", mobile: "9876543210", email: "ravi@shop.in", emailVerified: true },
    branchCount: 1,
    userCount: 1,
  };

  function platform(current: PlatformBusinessDto) {
    let shop = current;
    const mail = new FakeMail();
    const repo = stub<IPlatformRepository>({
      findBusiness: async () => shop,
      setBusinessStatus: async (_id, status) => {
        shop = { ...shop, status };
      },
      findOwnerContact: async () => ({ firstName: "Ravi", email: "ravi@shop.in" }),
    });
    return { svc: new PlatformService(repo, mail, new FakeAudit(), new FakeLimiter()), mail };
  }
  const admin = { adminId: "admin-1", email: "admin@product.in" };

  it("approving a shop activates it and emails the owner", async () => {
    const { svc, mail } = platform(pending);
    const after = await svc.updateStatus(admin, pending.id, { status: "ACTIVE", note: null });
    expect(after.status).toBe("ACTIVE");
    expect(mail.sent[0]!.subject).toContain("approved");
  });

  it("only an active shop can be suspended", async () => {
    const { svc } = platform(pending);
    await expectHttp(svc.updateStatus(admin, pending.id, { status: "SUSPENDED", note: null }), 400);
  });
});

describe("Book a quick demo", () => {
  function setup() {
    const saved: unknown[] = [];
    const mail = new FakeMail();
    const repo = stub<IPlatformRepository>({
      createDemoRequest: async (data) => {
        saved.push(data);
        return { id: "d1", handledAt: null, createdAt: new Date(), ...data };
      },
    });
    return { svc: new PlatformService(repo, mail, new FakeAudit(), new FakeLimiter()), saved, mail };
  }

  it("needs only a valid phone number", () => {
    expect(demoRequestSchema.safeParse({ mobile: "98765 43210" }).data).toMatchObject({ mobile: "9876543210" });
    expect(demoRequestSchema.safeParse({ name: "Ravi", email: "" }).success).toBe(false);
    expect(demoRequestSchema.safeParse({ mobile: "12345" }).success).toBe(false);
  });

  it("saves the request and emails the platform admin", async () => {
    const { svc, saved, mail } = setup();
    const before = env.PLATFORM_ADMIN_NOTIFY_EMAIL;
    (env as { PLATFORM_ADMIN_NOTIFY_EMAIL?: string }).PLATFORM_ADMIN_NOTIFY_EMAIL = "owner@product.in";
    try {
      await svc.requestDemo(demoRequestSchema.parse({ name: "Ravi", mobile: "9876543210", email: "" }), "1.2.3.4");
    } finally {
      (env as { PLATFORM_ADMIN_NOTIFY_EMAIL?: string }).PLATFORM_ADMIN_NOTIFY_EMAIL = before;
    }
    expect(saved).toEqual([{ name: "Ravi", mobile: "9876543210", email: null, ip: "1.2.3.4" }]);
    expect(mail.sent[0]).toMatchObject({ to: "owner@product.in", subject: "Demo request: Ravi" });
  });

  it("silently drops a request with the spam trap filled in", async () => {
    const { svc, saved } = setup();
    await svc.requestDemo(demoRequestSchema.parse({ mobile: "9876543210", website: "http://spam" }));
    expect(saved).toEqual([]);
  });
});
