import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiError } from "./client";

const BASE = "http://localhost:8787";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_API_URL", BASE);
  });

  it("sends credentials and parses JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await api<{ id: string }>("/auth/me");
    expect(result).toEqual({ id: "1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/auth/me`);
    expect(init.credentials).toBe("include");
  });

  it("throws ApiError with status on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
          }),
      ),
    );
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 401 });
    await expect(api("/auth/me")).rejects.toBeInstanceOf(ApiError);
  });
});
