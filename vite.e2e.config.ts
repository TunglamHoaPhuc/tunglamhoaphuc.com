// Local-only config for reproducing production behaviour without a Cloudflare login: the same as vite.config.ts, but with
// `remoteBindings: false`, so D1 and R2 are the ones miniflare simulates under .cloudflare/state (the real ones are never reached;
// the AI binding has no local stand-in and simply fails when used). Never used for a deploy.
//   TLHP_CONTENT_SOURCE=d1 npx vite build --config vite.e2e.config.ts && npx vite preview --config vite.e2e.config.ts --port 3041
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { workersCacheCdnAdapter } from "@vinext/cloudflare/cache/workers-cache-cdn-adapter";

export default defineConfig({
  preview: { allowedHosts: true },
  plugins: [
    tailwindcss(),
    vinext({ cache: { cdn: workersCacheCdnAdapter() } }),
    cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }, remoteBindings: false }),
  ],
});
