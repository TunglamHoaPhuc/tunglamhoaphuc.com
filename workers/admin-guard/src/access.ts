import { jwtVerify, type JWTVerifyGetKey } from "jose";

export function readAccessToken(request: Request): string | null {
  const header = request.headers.get("cf-access-jwt-assertion");
  if (header) return header;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? match[1] : null;
}

export async function isValidAccessToken(
  token: string,
  keys: JWTVerifyGetKey,
  teamDomain: string,
  audience: string,
): Promise<boolean> {
  try {
    await jwtVerify(token, keys, {
      issuer: teamDomain,
      audience,
      algorithms: ["RS256"],
    });
    return true;
  } catch {
    return false;
  }
}
