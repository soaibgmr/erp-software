import { defineConfig } from "vitest/config";

// Tests don't touch a real database: services get in-memory fakes, and HTTP tests only hit
// routes that answer before any query. The env below satisfies src/config/env.ts.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_db",
      DIRECT_URL: "postgresql://test:test@localhost:5432/test_db",
      JWT_SECRET: "test-secret-test-secret-test-secret-123",
      CLIENT_ID: "test-client",
      APP_TIMEZONE: "Asia/Kolkata",
      SWAGGER_ENABLED: "true",
    },
  },
});
