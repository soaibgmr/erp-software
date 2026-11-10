import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ROOT, resolveSslRootCert } from "./database-url";

const base = "postgresql://u:p@db.example.com:6543/postgres";

describe("resolveSslRootCert", () => {
  it("makes a relative sslrootcert absolute against the api folder", () => {
    const out = new URL(resolveSslRootCert(`${base}?sslmode=verify-full&sslrootcert=certs/ca.crt`));
    expect(out.searchParams.get("sslrootcert")).toBe(resolve(API_ROOT, "certs/ca.crt"));
    expect(out.searchParams.get("sslmode")).toBe("verify-full");
    expect(out.username).toBe("u");
    expect(out.password).toBe("p");
  });

  it("points API_ROOT at the api folder", () => {
    expect(resolve(API_ROOT, "certs/supabase-ca.crt")).toBe(resolve(__dirname, "../../certs/supabase-ca.crt"));
  });

  it("leaves URLs without a relative sslrootcert untouched", () => {
    expect(resolveSslRootCert(base)).toBe(base);
    expect(resolveSslRootCert(`${base}?sslrootcert=system`)).toBe(`${base}?sslrootcert=system`);
    const abs = `${base}?sslrootcert=${encodeURIComponent(resolve("/etc/ca.crt"))}`;
    expect(resolveSslRootCert(abs)).toBe(abs);
  });
});
