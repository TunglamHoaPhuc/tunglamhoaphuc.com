import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersCacheConfig } from "@vinext/cloudflare/cache/config";

// T41e: Workers Cache on vinext's response entrypoint only (vite.config.ts); the default
// entrypoint keeps running routing on every request. Cache hits use no Worker CPU.
const cache = await createWorkersCacheConfig();
const adminOn = process.env.NODE_ENV !== "production" || process.env.TLHP_ADMIN === "1";

export default defineConfig({
  accountId: "b91a395bd9b7ab86ef4cba41d1d828ae",
  worker: defineWorker({
    name: "tlhp-web",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-02",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["v2.tunglamhoaphuc.com", "www.tunglamhoaphuc.com", "tunglamhoaphuc.com"],
    workersDev: false,
    observability: { enabled: true },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      // The site's pictures go straight from the asset store, with the cache rules in
      // public/_headers, and cost no Worker CPU.
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*", "!/images/*", "!/brand/*", "!/tibetan-study/*"],
    },
    ...cache,
    env: {
      ASSETS: bindings.assets(),
      // Original pictures (T42b, T42c): read by /anh-goc/, private, no public domain.
      MEDIA: bindings.r2({ name: "tlhp-media" }),
      // Workers AI for the Tibetan course's /api/analyze, /api/ask-ai and /api/crop-analyze (T17b).
      AI: bindings.ai(),
      // The site's data (T23, T24): read when CONTENT_SOURCE is d1.
      DB: bindings.d1({ id: "dfee6bc6-9acf-4fcf-b25c-3ca1535c689a", name: "tlhp-db" }),
      // Where pages read the content: snapshot | b2 | d1 (src/libs/content/repository.ts). One Worker serves
      // v2. and, after T22, www, so this is the one switch for both. `npm run deploy:v2` sets
      // TLHP_CONTENT_SOURCE to d1 (scripts/deploy-v2.mjs); everything run locally (dev, preview, CI's
      // e2e), where the simulated D1 is empty, reads the snapshot.
      CONTENT_SOURCE: bindings.text(process.env.TLHP_CONTENT_SOURCE ?? "snapshot"),
      // The admin (docs/admin-architecture.md): its secrets come from .dev.vars locally. They are declared only
      // in `vite dev` and in a build made with TLHP_ADMIN=1; the build that deploys www leaves them out, so the
      // admin answers 503 there until it is switched on on purpose (needs Workers Paid, see the doc 2.1).
      ...(adminOn
        ? {
            ADMIN_JWT_SECRET: bindings.secret(),
            ADMIN_ENC_KEY: bindings.secret(),
            ADMIN_BASE_URL: bindings.text(process.env.ADMIN_BASE_URL ?? "http://localhost:3001"),
          }
        : {}),
      ...cache.env,
    },
    exports: { ...cache.exports },
  }),
});
