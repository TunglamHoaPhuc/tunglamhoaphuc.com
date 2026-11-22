// B1: an article page that finds nothing asks the redirect table before it says 404 (src/libs/siteRedirect.ts).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryAdminDb } from "./helpers/adminDb";

const state = vi.hoisted(() => ({ db: null as unknown }));

class Redirected extends Error {
	constructor(
		readonly kind: "permanent" | "temporary",
		readonly to: string,
	) {
		super(`${kind} ${to}`);
	}
}

vi.mock("next/navigation", () => ({
	permanentRedirect: (to: string) => {
		throw new Redirected("permanent", to);
	},
	redirect: (to: string) => {
		throw new Redirected("temporary", to);
	},
}));
vi.mock("@/libs/siteDb", () => ({
	siteDb: async () => state.db,
	afterResponse: async (work: Promise<unknown>) => void (await work),
}));

import { redirectIfMoved } from "@/libs/siteRedirect";

function withTable() {
	const { raw } = memoryAdminDb();
	const insert = raw.prepare("INSERT INTO redirect (from_path, to_path, code, note, hits, active, created_at) VALUES (?, ?, ?, '', 0, ?, '2026')");
	insert.run("/dong-chay-hoang-phap/bai-cu", "/dong-chay-hoang-phap/bai-moi", 301, 1);
	insert.run("/tri-tue-phat-phap/tam", "/tri-tue-phat-phap/khac", 302, 1);
	insert.run("/tri-tue-phat-phap/tat", "/tri-tue-phat-phap/khac", 301, 0);
	// What the site hands the lookup: prepare().bind().all() and .run(), as D1 does.
	const db = {
		prepare: (sql: string) => ({
			bind: (...values: unknown[]) => ({
				all: async () => ({ results: raw.prepare(sql).all(...(values as never[])) }),
				run: async () => raw.prepare(sql).run(...(values as never[])),
			}),
		}),
	};
	return { raw, db };
}

const asked = async (path: string) => redirectIfMoved(path).then(() => null, (error: unknown) => error);

describe("redirectIfMoved", () => {
	beforeEach(() => {
		state.db = null;
	});

	it("sends a visitor of a moved article's old address to the new one (301) and counts the hit", async () => {
		const { raw, db } = withTable();
		state.db = db;
		const result = (await asked("/dong-chay-hoang-phap/bai-cu")) as Redirected;
		expect(result).toBeInstanceOf(Redirected);
		expect(result).toMatchObject({ kind: "permanent", to: "/dong-chay-hoang-phap/bai-moi" });
		expect(raw.prepare("SELECT hits FROM redirect WHERE from_path = '/dong-chay-hoang-phap/bai-cu'").get()).toEqual({ hits: 1 });
	});

	it("answers a temporary redirect with 302, and finds the address however it was spelt", async () => {
		const { db } = withTable();
		state.db = db;
		expect(await asked("/tri-tue-phat-phap/tam")).toMatchObject({ kind: "temporary", to: "/tri-tue-phat-phap/khac" });
		expect(await asked("/dong-chay-hoang-phap/bai-cu/")).toMatchObject({ kind: "permanent" });
	});

	it("lets the page go on to its 404 when there is no redirect, an inactive one, no database, or the lookup fails", async () => {
		const { db } = withTable();
		state.db = db;
		expect(await asked("/dong-chay-hoang-phap/khong-co")).toBeNull();
		expect(await asked("/tri-tue-phat-phap/tat")).toBeNull();
		state.db = null;
		expect(await asked("/dong-chay-hoang-phap/bai-cu")).toBeNull();
		state.db = {
			prepare: () => {
				throw new Error("D1 lỗi");
			},
		};
		expect(await asked("/dong-chay-hoang-phap/bai-cu")).toBeNull();
	});
});
