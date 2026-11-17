import { defineConfig } from "drizzle-kit";

// `npx drizzle-kit generate` writes the next SQL migration into migrations/ from src/db/schema.ts.
// Migrations are applied by `cf d1 migrations apply`, not by drizzle-kit.
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/db/schema.ts",
	out: "./migrations",
});
