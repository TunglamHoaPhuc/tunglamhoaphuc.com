import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import { isValidAccessToken, readAccessToken } from "./access";
import { decide } from "./policy";

export interface Env {
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
}

let accessKeys: JWTVerifyGetKey | undefined;

function forbidden(): Response {
  return Response.json(
    {
      success: false,
      error:
        "Kính mời quý vị đăng nhập trang quản trị trước khi thực hiện thao tác này.",
    },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (decide(request.method, pathname) === "pass") return fetch(request);

    const token = readAccessToken(request);
    if (token) {
      accessKeys ??= createRemoteJWKSet(
        new URL("/cdn-cgi/access/certs", env.ACCESS_TEAM_DOMAIN),
      );
      if (
        await isValidAccessToken(
          token,
          accessKeys,
          env.ACCESS_TEAM_DOMAIN,
          env.ACCESS_AUD,
        )
      ) {
        return fetch(request);
      }
    }

    console.warn("blocked admin API call", {
      method: request.method,
      path: pathname,
      hadToken: Boolean(token),
      ip: request.headers.get("cf-connecting-ip"),
    });
    return forbidden();
  },
} satisfies ExportedHandler<Env>;
