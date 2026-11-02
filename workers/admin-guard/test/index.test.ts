import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";

const env: Env = {
  ACCESS_TEAM_DOMAIN: "https://tlhp-test.cloudflareaccess.com",
  ACCESS_AUD: "test-aud",
};
const CERTS_URL = `${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;

let validToken: string;
let certs: unknown;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  certs = { keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" }] };
  validToken = await new SignJWT({ email: "database.tunglamhoaphuc@gmail.com" })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(env.ACCESS_TEAM_DOMAIN)
    .setAudience(env.ACCESS_AUD)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
});

function stubNetwork() {
  const originCalls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === CERTS_URL) return Response.json(certs);
      originCalls.push(url);
      return new Response("origin");
    }),
  );
  return originCalls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(console, "warn").mockRestore();
});

describe("admin guard worker", () => {
  it("passes public reads straight to the origin", async () => {
    const originCalls = stubNetwork();
    const response = await worker.fetch(
      new Request("https://www.tunglamhoaphuc.com/api/admin/schedule?t=1"),
      env,
    );
    expect(await response.text()).toBe("origin");
    expect(originCalls).toEqual(["https://www.tunglamhoaphuc.com/api/admin/schedule?t=1"]);
  });

  it("blocks a write without a login and never reaches the origin", async () => {
    const originCalls = stubNetwork();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await worker.fetch(
      new Request("https://www.tunglamhoaphuc.com/api/admin/posts", { method: "DELETE" }),
      env,
    );
    expect(response.status).toBe(403);
    expect(originCalls).toEqual([]);
  });

  it("blocks a write with a forged token", async () => {
    const originCalls = stubNetwork();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await worker.fetch(
      new Request("https://www.tunglamhoaphuc.com/api/admin/posts", {
        method: "POST",
        headers: { cookie: "CF_Authorization=forged.token.value" },
      }),
      env,
    );
    expect(response.status).toBe(403);
    expect(originCalls).toEqual([]);
  });

  it("lets a signed-in editor save", async () => {
    const originCalls = stubNetwork();
    const response = await worker.fetch(
      new Request("https://www.tunglamhoaphuc.com/api/admin/posts", {
        method: "POST",
        headers: { cookie: `CF_Authorization=${validToken}` },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(originCalls).toEqual(["https://www.tunglamhoaphuc.com/api/admin/posts"]);
  });
});
