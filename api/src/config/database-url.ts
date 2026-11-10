import { isAbsolute, resolve } from "node:path";

// The api/ folder (src/config or dist/config → ../..), so relative paths in env vars mean the same
// thing locally, from dist/ and on Vercel, whatever the process's working directory is.
export const API_ROOT = resolve(__dirname, "../..");

// `sslrootcert=certs/supabase-ca.crt` in DATABASE_URL is read by pg relative to the working
// directory. Make it absolute against `baseDir` so the CA file is found in every environment.
export function resolveSslRootCert(connectionString: string, baseDir: string = API_ROOT): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  const cert = url.searchParams.get("sslrootcert");
  if (!cert || cert === "system" || isAbsolute(cert)) return connectionString;
  url.searchParams.set("sslrootcert", resolve(baseDir, cert));
  return url.toString();
}
