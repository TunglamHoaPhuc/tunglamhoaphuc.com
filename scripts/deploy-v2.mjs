// npm run deploy:v2: build and deploy the Worker with the content source of the deployed
// site. cloudflare.config.ts reads TLHP_CONTENT_SOURCE and falls back to "snapshot", so a
// local `vite dev`, a local preview and CI's e2e (whose local D1 is empty) read the snapshot,
// and only a deploy reads D1. Set TLHP_CONTENT_SOURCE yourself to deploy another source.
import { spawnSync } from "node:child_process";
import { checkDeployEnv } from "./deploy-env.mjs";

// The admin answers only on the host named in ADMIN_BASE_URL, so a deploy without it (or with a wrong one) is stopped here.
const check = checkDeployEnv(process.env);
for (const warning of check.warnings) console.warn(`Cảnh báo: ${warning}`);
if (check.errors.length) {
	for (const error of check.errors) console.error(`Lỗi: ${error}`);
	process.exit(1);
}
if (check.adminBaseUrl) console.log(`Admin trả lời ở: ${check.adminBaseUrl}`);

const source = process.env.TLHP_CONTENT_SOURCE ?? "d1";
console.log(`Nguồn nội dung của bản deploy: ${source}`);
const result = spawnSync("npx", ["vinext-cloudflare", "deploy", ...process.argv.slice(2)], {
	stdio: "inherit",
	shell: true,
	env: { ...process.env, TLHP_CONTENT_SOURCE: source },
});
process.exit(result.status ?? 1);
