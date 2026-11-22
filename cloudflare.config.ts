import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersCacheConfig } from "@vinext/cloudflare/cache/config";

// v3.tunglamhoaphuc.com: the V3 design as a read-only front of the www site's data.
// It reads the same D1 database (DB) and the same picture store (MEDIA) as the Worker tlhp-web,
// so whatever is edited in www's admin (/quan-tri) shows here too. Nothing here writes to them.
const cache = await createWorkersCacheConfig();

export default defineConfig({
  accountId: "b91a395bd9b7ab86ef4cba41d1d828ae",
  worker: defineWorker({
    name: "tlhp-v3",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-02",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["v3.tunglamhoaphuc.com"],
    workersDev: false,
    observability: { enabled: true },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*", "!/tibetan-study/*", "!/fonts/*", "!/*.TTF"],
    },
    ...cache,
    env: {
      ASSETS: bindings.assets(),
      // Same bucket and database as tlhp-web (www); read only.
      MEDIA: bindings.r2({ name: "tlhp-media" }),
      DB: bindings.d1({ id: "dfee6bc6-9acf-4fcf-b25c-3ca1535c689a", name: "tlhp-db" }),
      AI: bindings.ai(),
      // snapshot locally (data/snapshot, not in git), d1 when deployed (scripts/deploy.mjs).
      CONTENT_SOURCE: bindings.text(process.env.TLHP_CONTENT_SOURCE ?? "snapshot"),
      ...cache.env,
    },
    exports: { ...cache.exports },
  }),
});
