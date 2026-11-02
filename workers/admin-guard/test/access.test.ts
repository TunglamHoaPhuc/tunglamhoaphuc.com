import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { isValidAccessToken, readAccessToken } from "../src/access";

const TEAM = "https://tlhp-test.cloudflareaccess.com";
const AUD = "test-aud";

let privateKey: CryptoKey;
let otherKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;

async function sign(
  key: CryptoKey,
  { issuer = TEAM, audience = AUD, expiresIn = "1h" } = {},
): Promise<string> {
  return new SignJWT({ email: "editor@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

describe("isValidAccessToken", () => {
  it("accepts a token signed by the team for this application", async () => {
    expect(await isValidAccessToken(await sign(privateKey), keys, TEAM, AUD)).toBe(true);
  });

  it("rejects a token for another Access application", async () => {
    const token = await sign(privateKey, { audience: "other-app" });
    expect(await isValidAccessToken(token, keys, TEAM, AUD)).toBe(false);
  });

  it("rejects a token from another team", async () => {
    const token = await sign(privateKey, { issuer: "https://evil.cloudflareaccess.com" });
    expect(await isValidAccessToken(token, keys, TEAM, AUD)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await sign(privateKey, { expiresIn: "-1m" });
    expect(await isValidAccessToken(token, keys, TEAM, AUD)).toBe(false);
  });

  it("rejects a token signed with a different key", async () => {
    expect(await isValidAccessToken(await sign(otherKey), keys, TEAM, AUD)).toBe(false);
  });

  it("rejects garbage", async () => {
    expect(await isValidAccessToken("not-a-jwt", keys, TEAM, AUD)).toBe(false);
  });
});

describe("readAccessToken", () => {
  it("prefers the Access header", () => {
    const request = new Request("https://www.tunglamhoaphuc.com/api/admin/posts", {
      headers: { "cf-access-jwt-assertion": "from-header", cookie: "CF_Authorization=from-cookie" },
    });
    expect(readAccessToken(request)).toBe("from-header");
  });

  it("reads the CF_Authorization cookie among other cookies", () => {
    const request = new Request("https://www.tunglamhoaphuc.com/api/admin/posts", {
      headers: { cookie: "a=1; CF_Authorization=abc.def.ghi; b=2" },
    });
    expect(readAccessToken(request)).toBe("abc.def.ghi");
  });

  it("returns null without a token", () => {
    const request = new Request("https://www.tunglamhoaphuc.com/api/admin/posts", {
      headers: { cookie: "XCF_Authorization=nope" },
    });
    expect(readAccessToken(request)).toBeNull();
  });
});
