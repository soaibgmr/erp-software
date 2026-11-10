import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { HttpError } from "../common/http-error";
import { authFor, branch, FakeAudit, ids, roles, stub } from "../test/fakes";
import { UserService } from "./users/user.service";
import { RoleService } from "./roles/role.service";
import { CustomerService } from "./customers/customer.service";
import { DocumentSequenceService } from "./document-sequences/document-sequence.service";
import { BranchService } from "./branches/branch.service";
import type { IUserRepository } from "./users/interfaces/iuser.repository";
import type { IRefreshTokenRepository } from "./users/interfaces/irefresh-token.repository";
import type { IRoleRepository } from "./roles/interfaces/irole.repository";
import type { IBranchRepository } from "./branches/interfaces/ibranch.repository";
import type { ICustomerRepository } from "./customers/interfaces/icustomer.repository";
import type { IDocumentSequenceRepository } from "./document-sequences/interfaces/idocument-sequence.repository";
import type { UserResponseDto } from "./users/user.types";
import type { CustomerResponseDto } from "./customers/customer.types";

async function expectHttp(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
}

const userDto = (
  id: string,
  roleKey: "OWNER" | "COUNTER",
  status: "ACTIVE" | "INACTIVE" = "ACTIVE",
): UserResponseDto => {
  const r = roleKey === "OWNER" ? roles.owner : roles.counter;
  return {
    id,
    firstName: "Test",
    lastName: "User",
    email: `${id}@example.com`,
    phone: null,
    status,
    lastLoginAt: null,
    role: { id: r.id, key: r.key, name: r.name },
    branches: [{ id: ids.branchA, code: "A", name: "Branch A" }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

function userService(opts: { users?: Record<string, UserResponseDto>; activeOwners?: number } = {}) {
  const users = opts.users ?? {};
  const userRepo = stub<IUserRepository>({
    findById: async (id) => users[id] ?? null,
    existsByEmail: async () => false,
    countActiveOwners: async () => opts.activeOwners ?? 0,
    create: async (data) => ({ ...userDto("new", "COUNTER"), email: data.email }),
    update: async (id) => users[id] ?? null,
    softDelete: async () => true,
  });
  const tokens = stub<IRefreshTokenRepository>({ revokeAllForUser: async () => {} });
  const roleRepo = stub<IRoleRepository>({
    findById: async (id) => Object.values(roles).find((r) => r.id === id) ?? null,
  });
  const branchRepo = stub<IBranchRepository>({
    findManyByIds: async (list) => list.filter((b) => [ids.branchA, ids.branchB].includes(b)).map((b) => branch(b)),
  });
  return new UserService(userRepo, tokens, roleRepo, branchRepo, new FakeAudit());
}

const newUser = {
  firstName: "A",
  lastName: "B",
  email: "a@b.co",
  password: "password-1",
  phone: null,
  status: "ACTIVE" as const,
};

describe("UserService permission rules", () => {
  it("a non-owner can't assign the Owner role", async () => {
    await expectHttp(
      userService().create(authFor("manager"), { ...newUser, roleId: ids.ownerRole, branchIds: [ids.branchA] }),
      403,
    );
  });

  it("a non-owner can't assign branches they don't have", async () => {
    await expectHttp(
      userService().create(authFor("manager", [ids.branchA]), {
        ...newUser,
        roleId: ids.counterRole,
        branchIds: [ids.branchB],
      }),
      403,
    );
  });

  it("a manager can create a counter user in their branch", async () => {
    const user = await userService().create(authFor("manager"), {
      ...newUser,
      roleId: ids.counterRole,
      branchIds: [ids.branchA],
    });
    expect(user.email).toBe("a@b.co");
  });

  it("non-owner roles need at least one branch", async () => {
    await expectHttp(
      userService().create(authFor("owner"), { ...newUser, roleId: ids.counterRole, branchIds: [] }),
      400,
    );
  });

  it("you can't change your own role", async () => {
    const svc = userService({ users: { [ids.owner]: userDto(ids.owner, "OWNER") } });
    await expectHttp(svc.update(authFor("owner"), ids.owner, { roleId: ids.counterRole }), 400);
  });

  it("the last active owner can't be deactivated", async () => {
    const other = "00000000-0000-4000-8000-000000000099";
    const svc = userService({ users: { [other]: userDto(other, "OWNER") }, activeOwners: 0 });
    await expectHttp(svc.update(authFor("owner"), other, { status: "INACTIVE" }), 400);
  });

  it("a non-owner can't edit an owner", async () => {
    const svc = userService({ users: { [ids.owner]: userDto(ids.owner, "OWNER") } });
    await expectHttp(svc.update(authFor("manager"), ids.owner, { phone: null }), 403);
  });

  it("you can't delete yourself", async () => {
    await expectHttp(userService().remove(authFor("owner"), ids.owner), 400);
  });
});

describe("RoleService", () => {
  const roleRepo = stub<IRoleRepository>({
    findById: async (id) => Object.values(roles).find((r) => r.id === id) ?? null,
    existsByName: async () => false,
    create: async (data) => ({ ...roles.counter, id: "new", key: null, isSystem: false, ...data, description: null }),
  });
  const svc = new RoleService(roleRepo, new FakeAudit());

  it("non-owners can't grant permissions they lack", async () => {
    await expectHttp(
      svc.create(authFor("manager"), { name: "X", description: null, permissions: ["settings.manage"] }),
      403,
    );
  });

  it("the Owner role can't be edited", async () => {
    await expectHttp(svc.update(authFor("owner"), ids.ownerRole, { permissions: [] }), 400);
  });

  it("system roles can't be deleted", async () => {
    await expectHttp(svc.remove(authFor("owner"), ids.counterRole), 400);
  });
});

describe("CustomerService", () => {
  const existing: CustomerResponseDto = {
    id: "30000000-0000-4000-8000-000000000001",
    type: "RETAIL",
    name: "Rakesh Menon",
    mobile: "9847012345",
    alternatePhone: null,
    email: null,
    address: null,
    city: null,
    pincode: null,
    stateCode: null,
    gstin: null,
    creditLimit: "0.00",
    creditDays: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const audit = new FakeAudit();
  const repo = stub<ICustomerRepository>({
    findById: async (id) => (id === existing.id ? existing : null),
    findByMobile: async (mobile, excludeId) =>
      mobile === existing.mobile && excludeId !== existing.id ? existing : null,
    update: async (_id, data) => ({
      ...existing,
      ...data,
      creditLimit: data.creditLimit?.toFixed(2) ?? existing.creditLimit,
    }),
  });
  const svc = new CustomerService(repo, audit);

  it("rejects a mobile that belongs to another customer", async () => {
    const input = { type: "RETAIL" as const, name: "X", mobile: "9847012345", creditLimit: 0, creditDays: 0 };
    await expectHttp(svc.create(authFor("counter"), input), 409);
  });

  it("applies B2B rules to the merged record on PATCH", async () => {
    await expectHttp(svc.update(authFor("counter"), existing.id, { type: "B2B" }), 400);
  });

  it("audits credit term changes", async () => {
    await svc.update(authFor("counter"), existing.id, { creditLimit: 50000 });
    expect(audit.entries.at(-1)?.action).toBe("customer.credit.update");
  });
});

describe("DocumentSequenceService", () => {
  const taken: unknown[] = [];
  const repo = stub<IDocumentSequenceRepository>({
    findLatestBefore: async () => ({
      docType: "INVOICE",
      financialYear: 2025,
      prefix: "KB",
      padding: 6,
      nextNumber: 900,
    }),
    take: async (_db, _branch, _type, fy, defaults) => {
      taken.push({ fy, defaults });
      return { sequence: 1874, prefix: "INV", padding: 5 };
    },
    findForYear: async () => [{ docType: "INVOICE", financialYear: 2026, prefix: "INV", padding: 5, nextNumber: 12 }],
  });
  const branches = stub<IBranchRepository>({ findById: async (id) => branch(id) });
  const svc = new DocumentSequenceService(repo, branches, new FakeAudit());

  it("formats the issued number with the financial year of the date (IST)", async () => {
    const issued = await svc.next({} as never, ids.branchA, "INVOICE", new Date("2026-11-09T06:18:00Z"));
    expect(issued).toEqual({ number: "INV-26-01874", sequence: 1874, financialYear: 2026 });
    // A new year's row starts from last year's prefix and padding.
    expect(taken.at(-1)).toEqual({
      fy: 2026,
      defaults: { docType: "INVOICE", financialYear: 2026, prefix: "KB", padding: 6, nextNumber: 1 },
    });
  });

  it("locks the format once numbers are issued", async () => {
    await expectHttp(svc.update(authFor("owner"), ids.branchA, "INVOICE", { prefix: "NEW", padding: 5 }), 409);
  });

  it("checks branch access", async () => {
    await expectHttp(svc.list(authFor("counter", [ids.branchA]), ids.branchB), 403);
  });
});

describe("BranchService", () => {
  it("non-owners only list their own branches", async () => {
    let seenIds: string[] | undefined = ["unset"];
    const repo = stub<IBranchRepository>({
      list: async (filter) => {
        seenIds = filter.ids;
        return [];
      },
    });
    const svc = new BranchService(repo, new FakeAudit());
    await svc.list(authFor("counter", [ids.branchA]), { includeInactive: false });
    expect(seenIds).toEqual([ids.branchA]);
    await svc.list(authFor("owner"), { includeInactive: false });
    expect(seenIds).toBeUndefined();
  });

  it("keeps at least one active branch", async () => {
    const repo = stub<IBranchRepository>({ findById: async (id) => branch(id), countActive: async () => 1 });
    await expectHttp(new BranchService(repo, new FakeAudit()).remove(authFor("owner"), ids.branchA), 400);
  });
});
