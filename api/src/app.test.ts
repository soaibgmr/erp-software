import "reflect-metadata";
import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "./app";

// HTTP-level checks that answer before any database query.
describe("HTTP pipeline", () => {
  it("serves health without a client id", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok", timezone: "Asia/Kolkata" } });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("requires the clientid header on API routes", async () => {
    const res = await request(app).get("/api/v1/customers");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("ClientId header is missing");
  });

  it("requires a bearer token", async () => {
    const res = await request(app).get("/api/v1/customers").set("clientid", "test-client");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("clientid", "test-client")
      .set("authorization", "Bearer nope");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid or expired token");
  });

  it("validates shop registration bodies", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("clientid", "test-client")
      .send({ shopName: "A", mobile: "12345" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.mobile).toBeTruthy();
    expect(res.body.error.details.fieldErrors.password).toBeTruthy();
  });

  it("validates login bodies (mobile number or email)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("clientid", "test-client")
      .send({ identifier: "12345", password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors.identifier).toBeTruthy();
  });

  it("platform routes reject requests without a platform token", async () => {
    const res = await request(app).get("/api/v1/platform/businesses").set("clientid", "test-client");
    expect(res.status).toBe(401);
  });

  it("allows the UI origin through CORS with the branch header", async () => {
    const res = await request(app)
      .options("/api/v1/customers")
      .set("origin", "http://localhost:5173")
      .set("access-control-request-method", "GET")
      .set("access-control-request-headers", "x-branch-id,clientid,authorization");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-headers"]).toContain("x-branch-id");
  });

  it("serves the OpenAPI document with Phase 1 routes", async () => {
    const res = await request(app).get("/docs/openapi.json");
    expect(res.status).toBe(200);
    for (const path of [
      "/api/v1/customers",
      "/api/v1/branches",
      "/api/v1/roles",
      "/api/v1/settings/{group}",
      "/api/v1/audit-logs",
    ]) {
      expect(res.body.paths[path]).toBeDefined();
    }
  });

  it("serves the Swagger UI page with its assets from the CDN", async () => {
    const res = await request(app).get("/docs/");
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.text).toContain("https://cdn.jsdelivr.net/npm/swagger-ui-dist@");
    expect(res.text).toContain('url: "/docs/openapi.json"');

    const bare = await request(app).get("/docs");
    expect(bare.status).toBe(301);
    expect(bare.headers.location).toBe("/docs/");
  });

  it("documents the Phase 2 inventory routes", async () => {
    const res = await request(app).get("/docs/openapi.json");
    for (const path of [
      "/api/v1/items",
      "/api/v1/items/search",
      "/api/v1/brands",
      "/api/v1/vehicle-models",
      "/api/v1/labour-services",
      "/api/v1/stock",
      "/api/v1/stock/adjustments",
      "/api/v1/stock/transfers/{id}/receive",
      "/api/v1/stock/import",
      "/api/v1/invoices",
      "/api/v1/invoices/{id}/cancel",
      "/api/v1/pos/quote",
      "/api/v1/shifts/open",
      "/api/v1/credit-notes",
      "/api/v1/payments/{id}/reverse",
    ]) {
      expect(res.body.paths[path]).toBeDefined();
    }
  });

  it("guards the inventory routes with auth", async () => {
    for (const path of [
      "/api/v1/items",
      "/api/v1/stock",
      "/api/v1/brands",
      "/api/v1/labour-services",
      "/api/v1/invoices",
      "/api/v1/shifts",
    ]) {
      const res = await request(app).get(path).set("clientid", "test-client");
      expect(res.status).toBe(401);
    }
  });
});
