import bcrypt from "bcryptjs";
import { SYSTEM_ROLE_KEYS, SYSTEM_ROLES, STATE_CODES } from "@automobile/shared";
import { prisma } from "../config/database";
import { BCRYPT_ROUNDS } from "../common/constants";

// Idempotent first-install seed: system roles, the business profile, a main branch and the owner account.
// Re-running never overwrites data someone has edited (role permissions, business details, passwords).
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");

  const stateCode = process.env.SEED_STATE_CODE ?? "32";
  if (!STATE_CODES.includes(stateCode)) throw new Error(`SEED_STATE_CODE ${stateCode} is not a GST state code`);

  // System roles. A role created by a migration with no permissions gets the defaults.
  for (const key of SYSTEM_ROLE_KEYS) {
    const def = SYSTEM_ROLES[key];
    const existing = await prisma.role.findUnique({ where: { key } });
    if (!existing) {
      await prisma.role.create({
        data: { key, name: def.name, description: def.description, permissions: def.permissions, isSystem: true },
      });
    } else if (existing.permissions.length === 0) {
      await prisma.role.update({ where: { key }, data: { permissions: def.permissions } });
    }
  }
  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { key: "OWNER" } });

  if (!(await prisma.business.findFirst())) {
    await prisma.business.create({
      data: {
        legalName: process.env.SEED_BUSINESS_NAME ?? "Automobile.In",
        stateCode,
        city: process.env.SEED_CITY ?? "Kochi",
      },
    });
  }

  const branch =
    (await prisma.branch.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.branch.create({
      data: { code: "MAIN", name: "Main branch", city: process.env.SEED_CITY ?? "Kochi", stateCode },
    }));

  const owner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      firstName: "System",
      lastName: "Owner",
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      roleId: ownerRole.id,
      status: "ACTIVE",
      branches: { create: [{ branchId: branch.id }] },
    },
  });

  console.log(`Seeded roles, business, branch ${branch.code} and owner ${owner.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
