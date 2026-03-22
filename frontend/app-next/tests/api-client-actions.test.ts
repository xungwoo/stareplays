import {
  buildCurrentUserSessionCookie,
  clearCurrentUserSessionCookie,
  deserializeCurrentUserSession,
  parseCurrentUserSessionCookie,
  serializeCurrentUserSession
} from "@/lib/utils/current-user-session";
import { resolveCurrentUser } from "@/lib/api/client";
import { postApiJson, previewReplayUpload, submitReplayUpload } from "@/lib/api/actions";

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload
  } as Response;
}

describe("current-user session helpers", () => {
  it("round-trips a url-encoded cookie value", () => {
    const serialized = serializeCurrentUserSession(" 3x3 GG/Player+One ");

    expect(serialized).toBe("3x3%20GG%2FPlayer%2BOne");
    expect(deserializeCurrentUserSession(serialized)).toBe("3x3 GG/Player+One");
  });

  it("builds a current user cookie pair for persistence", () => {
    expect(buildCurrentUserSessionCookie(" 3x3 GG/Player+One ")).toBe("current_user=3x3%20GG%2FPlayer%2BOne; Path=/; SameSite=Lax");
  });

  it("builds a current user cookie clear directive", () => {
    expect(clearCurrentUserSessionCookie()).toBe("current_user=; Path=/; Max-Age=0; SameSite=Lax");
  });

  it("reads the current user from a cookie header string", () => {
    expect(parseCurrentUserSessionCookie("foo=1; current_user=3x3%20GG; bar=2")).toBe("3x3 GG");
  });

  it("ignores malformed current user cookie values", () => {
    expect(parseCurrentUserSessionCookie("current_user=%E0%A4%A")).toBeNull();
  });

  it("resolves the current user from the session cookie when no override is provided", () => {
    expect(resolveCurrentUser(undefined, "current_user=3x3%20GG%2FPlayer%2BOne")).toBe("3x3 GG/Player+One");
  });

  it("prefers the explicit current user override over the session cookie", () => {
    expect(resolveCurrentUser("  override-user  ", "current_user=3x3%20GG")).toBe("override-user");
  });
});

describe("api actions", () => {
  it("posts json with api defaults", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://example.test/api/v1/analyzer/reanalyze");
      expect(init?.method).toBe("POST");
      expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).get("accept")).toBe("application/json");
      expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
      expect(init?.body).toBe(JSON.stringify({ game_id: 48 }));

      return createJsonResponse({ ok: true });
    });

    await expect(
      postApiJson("/api/v1/analyzer/reanalyze", { game_id: 48 }, {
        apiBaseUrl: "http://example.test",
        fetchImpl: fetchMock
      })
    ).resolves.toEqual({ ok: true });
  });

  it("throws the API error message for non-ok json responses", async () => {
    const fetchMock = vi.fn(async () =>
      ({
        ok: false,
        json: async () => ({ error: "reanalyze failed" })
      }) as Response
    );

    await expect(
      postApiJson("/api/v1/analyzer/reanalyze", { game_id: 48 }, {
        apiBaseUrl: "http://example.test",
        fetchImpl: fetchMock
      })
    ).rejects.toThrow("reanalyze failed");
  });

  it("builds upload preview multipart bodies with replay files", async () => {
    const files = [
      new File(["alpha"], "first.rep", { type: "application/octet-stream" }),
      new File(["beta"], "second.rep", { type: "application/octet-stream" })
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://example.test/api/v1/games/upload/preview");
      expect(init?.method).toBe("POST");
      expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).get("accept")).toBe("application/json");

      const body = init?.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect(body.getAll("replay_files")).toHaveLength(2);
      expect(body.get("uploader_name")).toBeNull();

      return createJsonResponse({ preview: true });
    });

    await expect(
      previewReplayUpload(files, {
        apiBaseUrl: "http://example.test",
        fetchImpl: fetchMock
      })
    ).resolves.toEqual({ preview: true });
  });

  it("builds upload multipart bodies with uploader name", async () => {
    const files = [new File(["alpha"], "first.rep", { type: "application/octet-stream" })];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://example.test/api/v1/games/upload");
      expect(init?.method).toBe("POST");
      expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).get("accept")).toBe("application/json");

      const body = init?.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect(body.getAll("replay_files")).toHaveLength(1);
      expect(body.get("uploader_name")).toBe("3x3_GG");

      return createJsonResponse({ game: { id: 1 } });
    });

    await expect(
      submitReplayUpload(files, "3x3_GG", {
        apiBaseUrl: "http://example.test",
        fetchImpl: fetchMock
      })
    ).resolves.toEqual({ game: { id: 1 } });
  });
});
