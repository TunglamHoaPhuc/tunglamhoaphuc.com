// Prepares the LOCAL D1 that `npm run dev` uses (.cloudflare/state), never the real one:
//   npm run dev:db              apply migrations that are not applied yet
//   npm run dev:db -- --init    also write .dev.vars with fresh secrets if there is none
//   npm run dev:db -- --seed    also make the system roles and the first Super Admin
//                               (ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD, from the environment or .dev.vars)
// Stop `npm run dev` first: the file is open while it runs.
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { seedRoles, seedSuperAdmin } from "../src/admin/seed";
import { asAdminDb } from "../src/db/nodeAdminDb";
import { MIGRATIONS_DIR, openDatabase } from "../src/db/nodeSqlite";

const STATE_DIR = ".cloudflare/state/v3/d1/miniflare-D1DatabaseObject";
const DEV_VARS = ".dev.vars";
const args = new Set(process.argv.slice(2));

function findDatabaseFile(): string {
	if (!existsSync(STATE_DIR)) throw new Error(`${STATE_DIR} does not exist: run \`npm run dev\` once, stop it, then run this again.`);
	const files = readdirSync(STATE_DIR).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
	if (files.length !== 1) throw new Error(`Expected one local D1 file in ${STATE_DIR}, found ${files.length}. Say which with --db=<path>.`);
	return join(STATE_DIR, files[0]);
}

function readVars(): Record<string, string> {
	if (!existsSync(DEV_VARS)) return {};
	const out: Record<string, string> = {};
	for (const line of readFileSync(DEV_VARS, "utf8").split(/\r?\n/)) {
		const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (match) out[match[1]] = match[2].replace(/^"|"$/g, "");
	}
	return out;
}

function initVars() {
	if (existsSync(DEV_VARS)) return console.log(`${DEV_VARS} exists, left as it is.`);
	const lines = [
		`ADMIN_JWT_SECRET=${randomBytes(48).toString("base64url")}`,
		`ADMIN_ENC_KEY=${randomBytes(32).toString("base64")}`,
		"ADMIN_BASE_URL=http://localhost:3001",
		"ADMIN_SEED_EMAIL=admin@localhost.test",
		`ADMIN_SEED_PASSWORD=${randomBytes(12).toString("base64url")}`,
		// the e2e tests change the one-time seed password to this one at their first run (tests/e2e/admin/helpers.ts)
		`ADMIN_E2E_PASSWORD=E2e-${randomBytes(12).toString("base64url")}`,
	];
	writeFileSync(DEV_VARS, `${lines.join("\n")}\n`);
	console.log(`Wrote ${DEV_VARS} (git-ignored) with new secrets and a first sign-in; read it there.`);
}

async function main() {
	const explicit = process.argv.find((arg) => arg.startsWith("--db="))?.slice(5);
	const file = explicit ?? findDatabaseFile();
	if (args.has("--init")) initVars();
	const raw = openDatabase(file);

	raw.exec("CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
	const done = new Set((raw.prepare("SELECT name FROM d1_migrations").all() as { name: string }[]).map((row) => row.name));
	const todo = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql") && !done.has(name)).sort();
	for (const name of todo) {
		raw.exec("BEGIN");
		try {
			raw.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
			raw.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
			raw.exec("COMMIT");
			console.log(`applied ${name}`);
		} catch (error) {
			raw.exec("ROLLBACK");
			throw new Error(`${name} failed: ${(error as Error).message}`, { cause: error });
		}
	}
	if (!todo.length) console.log("migrations up to date");

	if (args.has("--seed")) {
		const vars = { ...readVars(), ...process.env };
		const email = vars.ADMIN_SEED_EMAIL;
		const password = vars.ADMIN_SEED_PASSWORD;
		if (!email || !password) throw new Error("ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are needed for --seed (use --init to make them).");
		const db = asAdminDb(raw);
		await seedRoles(db, new Date());
		const id = await seedSuperAdmin(db, { email, password }, new Date());
		console.log(id ? `made the first Super Admin (${email})` : "a Super Admin exists already; nothing added");
	}
	raw.close();
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
