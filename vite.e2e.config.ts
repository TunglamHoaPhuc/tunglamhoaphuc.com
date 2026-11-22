// Dev server for the e2e tests on a machine with no Cloudflare login: the same as vite.config.ts, but with `remoteBindings: false`, so
// the Worker's D1 and R2 are the ones miniflare simulates under .cloudflare/state (the real ones are never reached) and `vite dev`
// does not ask to sign in. How to run it: see the head of tests/e2e/admin/helpers.ts.
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { workersCacheCdnAdapter } from "@vinext/cloudflare/cache/workers-cache-cdn-adapter";

export default defineConfig({
  preview: { allowedHosts: true },
  plugins: [
    vinext({ cache: { cdn: workersCacheCdnAdapter() } }),
    cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }, remoteBindings: false }),
  ],
});
