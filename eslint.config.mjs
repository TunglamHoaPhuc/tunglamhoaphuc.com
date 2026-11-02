import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"node_modules/",
			".next/",
			"reference/",
			"workers/",
			"public/",
			"dist/",
			".vinext/",
			".cloudflare/",
			"graphify-out/",
			"test-results/",
			"playwright-report/",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.{js,jsx,mjs,ts,tsx}"],
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
		plugins: { "react-hooks": reactHooks },
		rules: reactHooks.configs.recommended.rules,
	},
	{
		// Bexon template code as shipped: report, don't block. Clean each file up when a
		// task touches it; new TypeScript code keeps these rules as errors.
		files: ["src/**/*.{js,jsx}"],
		rules: {
			"@typescript-eslint/no-unused-vars": "warn",
			"@typescript-eslint/no-unused-expressions": "warn",
			"@typescript-eslint/no-this-alias": "warn",
			"react-hooks/refs": "warn",
			"react-hooks/set-state-in-effect": "warn",
			"no-irregular-whitespace": "warn",
			"no-unsafe-optional-chaining": "warn",
			"no-redeclare": "warn",
			"no-case-declarations": "warn",
			"no-dupe-else-if": "warn",
		},
	},
);
