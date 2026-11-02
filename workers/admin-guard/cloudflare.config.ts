import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

// ACCESS_AUD is the audience tag of the Access application "Admin site cũ (www)"
// (docs/van-hanh/admin-cu.md). Renaming the Zero Trust team changes ACCESS_TEAM_DOMAIN.
export default defineConfig({
  accountId: "b91a395bd9b7ab86ef4cba41d1d828ae",
  worker: {
    name: "tlhp-admin-guard",
    entrypoint,
    compatibilityDate: "2026-10-01",
    env: {
      ACCESS_TEAM_DOMAIN: bindings.text("https://lingering-heart-cb52.cloudflareaccess.com"),
      ACCESS_AUD: bindings.text("132420dfd3a001eb302b1545c9c347c40006c6354281c083869d58c9f919070a"),
    },
    triggers: [
      triggers.fetch({ pattern: "www.tunglamhoaphuc.com/api/*", zone: "tunglamhoaphuc.com" }),
    ],
    workersDev: false,
    observability: { enabled: true },
  },
});
