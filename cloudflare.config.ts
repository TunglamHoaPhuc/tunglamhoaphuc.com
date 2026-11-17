import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersCacheConfig } from "@vinext/cloudflare/cache/config";

// T41e: Workers Cache on vinext's response entrypoint only (vite.config.ts); the default
// entrypoint keeps running routing on every request. Cache hits use no Worker CPU.
const cache = await createWorkersCacheConfig();

export default defineConfig({
  accountId: "b91a395bd9b7ab86ef4cba41d1d828ae",
  worker: defineWorker({
    name: "tlhp-web",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-02",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["v2.tunglamhoaphuc.com"],
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
      ...cache.env,
    },
    exports: { ...cache.exports },
  }),
});
