// @types/node 20 does not know node:sqlite (Node 22.5+). Only what the tests (tests/helpers/d1.ts, real-db.ts) use.
declare module "node:sqlite" {
	export class DatabaseSync {
		constructor(path: string, options?: { readOnly?: boolean });
		exec(sql: string): void;
		close(): void;
		prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
	}
}
