// npm run deploy: build and deploy the Worker tlhp-v3 reading www's D1 (see cloudflare.config.ts).
import { spawnSync } from "node:child_process";

const source = process.env.TLHP_CONTENT_SOURCE ?? "d1";
console.log(`Nguồn nội dung của bản deploy: ${source}`);
const result = spawnSync("npx", ["vinext-cloudflare", "deploy", ...process.argv.slice(2)], {
	stdio: "inherit",
	shell: true,
	env: { ...process.env, TLHP_CONTENT_SOURCE: source },
});
process.exit(result.status ?? 1);
