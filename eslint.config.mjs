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
		rules: {
			...reactHooks.configs.recommended.rules,
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{ name: "sweetalert2", message: "Không dùng hộp thông báo nổi: phản hồi hiện ngay trong trang (UX-05)." },
						{ name: "isotope-layout", message: "Đã gỡ ở T2: lọc danh sách làm phía server." },
						{ name: "imagesloaded", message: "Đã gỡ ở T2 cùng isotope-layout." },
						{ name: "nice-select2", message: "Đã gỡ ở T2: ô chọn dùng <select> gốc." },
						{ name: "react-range-slider-input", message: "Đã gỡ ở T2 cùng trang shop." },
					],
				},
			],
		},
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
