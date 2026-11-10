import bcrypt from "bcryptjs";
import { isValidMobile, normalizeMobile, STATE_CODES } from "@erp-software/shared";
import { prisma } from "../config/database";
import { BCRYPT_ROUNDS } from "../common/constants";
import { provisionBusiness } from "../modules/business/provision";

// Idempotent seed:
// 1. The platform admin (approves shops at /admin) from SEED_PLATFORM_ADMIN_EMAIL / _PASSWORD.
// 2. Optionally a demo shop, ACTIVE, with its owner, from SEED_ADMIN_EMAIL / _MOBILE / _PASSWORD.
// Re-running never overwrites data someone has edited (passwords, business details, roles).
async function main() {
  await seedPlatformAdmin();
  await seedDemoShop();
}

async function seedPlatformAdmin() {
  const email = process.env.SEED_PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Skipped the platform admin: set SEED_PLATFORM_ADMIN_EMAIL and SEED_PLATFORM_ADMIN_PASSWORD");
    return;
  }
  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    update: {},
    create: { email, name: "Platform admin", passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
  });
  console.log(`Platform admin: ${admin.email}`);
}

async function seedDemoShop() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Skipped the demo shop: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
    return;
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    console.log(`Demo shop owner ${email} already exists`);
    return;
  }

  const stateCode = process.env.SEED_STATE_CODE ?? "32";
  if (!STATE_CODES.includes(stateCode)) throw new Error(`SEED_STATE_CODE ${stateCode} is not a GST state code`);
  const rawMobile = process.env.SEED_ADMIN_MOBILE;
  if (rawMobile && !isValidMobile(rawMobile)) throw new Error(`SEED_ADMIN_MOBILE ${rawMobile} is not a mobile number`);
  const mobile = rawMobile ? normalizeMobile(rawMobile) : null;

  const created = await prisma.$transaction((tx) =>
    provisionBusiness(tx, {
      status: "ACTIVE",
      legalName: process.env.SEED_BUSINESS_NAME ?? "Demo Auto Parts",
      city: process.env.SEED_CITY ?? "Kochi",
      stateCode,
      owner: {
        firstName: "Shop",
        lastName: "Owner",
        mobile,
        email,
        emailVerifiedAt: new Date(),
        passwordHash: bcrypt.hashSync(password, BCRYPT_ROUNDS),
      },
    }),
  );
  console.log(`Demo shop ${created.businessId} with owner ${email}${mobile ? ` / ${mobile}` : ""}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
