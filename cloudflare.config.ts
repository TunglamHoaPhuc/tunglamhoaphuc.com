import { bindings, defineConfig, defineWorker } from "cf/config";

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
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*", "!/images/*", "!/brand/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
