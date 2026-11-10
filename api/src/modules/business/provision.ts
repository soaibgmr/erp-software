import type { BusinessStatus } from "@prisma/client";
import { SYSTEM_ROLE_KEYS, SYSTEM_ROLES } from "@erp-software/shared";
import type { Db } from "../../common/prisma-types";

export interface ProvisionBusinessInput {
  status: BusinessStatus;
  legalName: string;
  city: string;
  stateCode: string;
  gstin?: string | null;
  owner: {
    firstName: string;
    lastName: string;
    mobile: string | null;
    email: string | null;
    passwordHash: string;
    emailVerifiedAt?: Date | null;
  };
}

export interface ProvisionedBusiness {
  businessId: string;
  ownerId: string;
  branchId: string;
}

// Everything a new company needs to start: the business, its own copy of the system roles,
// a main branch and the owner account. Settings need no rows (missing groups use the defaults).
// Run it inside one transaction (sign-up, seed) so a half-made company never exists.
export async function provisionBusiness(db: Db, input: ProvisionBusinessInput): Promise<ProvisionedBusiness> {
  const business = await db.business.create({
    data: {
      status: input.status,
      approvedAt: input.status === "ACTIVE" ? new Date() : null,
      legalName: input.legalName,
      city: input.city,
      stateCode: input.stateCode,
      gstin: input.gstin ?? null,
      phone: input.owner.mobile,
      email: input.owner.email,
    },
    select: { id: true },
  });
  const businessId = business.id;

  await db.role.createMany({
    data: SYSTEM_ROLE_KEYS.map((key) => ({
      businessId,
      key,
      name: SYSTEM_ROLES[key].name,
      description: SYSTEM_ROLES[key].description,
      permissions: SYSTEM_ROLES[key].permissions,
      isSystem: true,
    })),
  });
  const ownerRole = await db.role.findUniqueOrThrow({
    where: { businessId_key: { businessId, key: "OWNER" } },
    select: { id: true },
  });

  const branch = await db.branch.create({
    data: { businessId, code: "MAIN", name: "Main branch", city: input.city, stateCode: input.stateCode },
    select: { id: true },
  });

  const owner = await db.user.create({
    data: {
      businessId,
      firstName: input.owner.firstName,
      lastName: input.owner.lastName,
      mobile: input.owner.mobile,
      email: input.owner.email,
      emailVerifiedAt: input.owner.emailVerifiedAt ?? null,
      passwordHash: input.owner.passwordHash,
      roleId: ownerRole.id,
      status: "ACTIVE",
      branches: { create: [{ branchId: branch.id }] },
    },
    select: { id: true },
  });

  return { businessId, ownerId: owner.id, branchId: branch.id };
}
