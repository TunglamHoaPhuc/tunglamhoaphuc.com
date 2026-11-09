import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { workersCacheCdnAdapter } from "@vinext/cloudflare/cache/workers-cache-cdn-adapter";

export default defineConfig({
  plugins: [
    // T41e: pages that declare `revalidate` are served from Cloudflare's Workers Cache, so a
    // view no longer renders the page (CPU and TTFB); see cloudflare.config.ts.
    vinext({ cache: { cdn: workersCacheCdnAdapter() } }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
