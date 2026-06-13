import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";

describe("CORS", () => {
  it("echoes the allowed origin and allows credentials", async () => {
    const res = await app.request(
      "/health",
      { headers: { origin: "http://localhost:5173" } },
      env,
    );
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("answers preflight requests", async () => {
    const res = await app.request(
      "/workouts",
      {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "POST",
        },
      },
      env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
  });
});
