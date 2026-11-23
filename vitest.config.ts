import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// A worktree shares node_modules with the main checkout (a link), and so would share Vite's transform cache: a module whose
// import.meta.glob was first read in a folder without data/snapshot/ would then stay empty in every checkout that has the same
// file. One cache folder per checkout folder keeps them apart.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	cacheDir: `node_modules/.vite-vitest/${basename(root)}`,
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		include: ["tests/unit/**/*.test.ts"],
		environment: "node",
	},
});
