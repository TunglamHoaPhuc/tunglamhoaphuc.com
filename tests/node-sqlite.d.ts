// @types/node 20 does not know node:sqlite (Node 22.5+). Only what tests/helpers/d1.ts uses.
declare module "node:sqlite" {
	export class DatabaseSync {
		constructor(path: string);
		exec(sql: string): void;
		prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
	}
}
