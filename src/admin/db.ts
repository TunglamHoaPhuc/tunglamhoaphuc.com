// The part of a D1 database the admin uses, and a few helpers. Raw SQL on purpose: every statement
// is visible, and tests run the same SQL against node:sqlite (tests/unit/helpers/adminDb.ts).
export type Row = Record<string, unknown>;

export type AdminStmt = {
	bind(...values: unknown[]): AdminStmt;
	first<T = Row>(): Promise<T | null>;
	all<T = Row>(): Promise<{ results: T[] }>;
	run(): Promise<{ meta: { changes: number } }>;
};

export type AdminDb = {
	prepare(sql: string): AdminStmt;
	/** Atomic: every statement is applied, or none when one fails (D1's batch). */
	batch(statements: AdminStmt[]): Promise<unknown[]>;
};

/** The Worker's bindings and secrets the admin reads. */
export type AdminEnv = {
	DB: AdminDb;
	/** Signs the access tokens (random, 32+ bytes). */
	ADMIN_JWT_SECRET: string;
	/** AES-256 key, base64 of 32 bytes: encrypts the 2FA secrets and the SMTP password. */
	ADMIN_ENC_KEY: string;
	/** The one address the admin answers on, e.g. https://www.tunglamhoaphuc.com */
	ADMIN_BASE_URL: string;
};

export const text = (value: unknown): string => (typeof value === "string" ? value : "");
export const num = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);
