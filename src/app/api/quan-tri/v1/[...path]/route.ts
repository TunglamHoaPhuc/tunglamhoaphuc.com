import { revalidatePath } from "next/cache";
import "@/admin/routes";
import { dispatch } from "@/admin/http/api";
import { affectsPublicSite } from "@/admin/http/publicEffect";
import type { AdminEnv } from "@/admin/db";
import { createSmtpMailer } from "@/admin/mail/smtp";
import type { BackupBucket } from "@/admin/ops/backup";
import { r2Store, type R2Like } from "@/admin/media/store";
import { bumpContentEpoch } from "@/libs/content/repository";

// The admin API (docs/admin-architecture.md 7). Never cached, never indexed; one address only (dispatch checks).
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function workerEnv(): Promise<(Partial<AdminEnv> & Record<string, unknown>) | undefined> {
	try {
		const workers = (await import("cloudflare:workers" as string)) as { env?: Partial<AdminEnv> & Record<string, unknown> };
		return workers.env;
	} catch {
		return undefined;
	}
}

async function waitUntil(work: Promise<unknown>): Promise<void> {
	try {
		const workers = (await import("cloudflare:workers" as string)) as { waitUntil?: (work: Promise<unknown>) => void };
		if (workers.waitUntil) return workers.waitUntil(work);
	} catch {
		// no Worker here (npm run dev outside workerd): the work runs on its own
	}
	void work.catch(() => undefined);
}

async function handle(request: Request, { params }: Context): Promise<Response> {
	const env = await workerEnv();
	const missing = ["DB", "ADMIN_JWT_SECRET", "ADMIN_ENC_KEY", "ADMIN_BASE_URL"].filter((name) => !env?.[name]);
	if (missing.length) {
		// Names only, never values: they tell whoever sets the server up what is still to configure.
		return Response.json({ error: { code: "not_configured", message: `Quản trị chưa được cấu hình trên máy chủ này (thiếu: ${missing.join(", ")}).` } }, { status: 503, headers: { "Cache-Control": "no-store" } });
	}
	if (!env) return new Response(null, { status: 503 });
	const { path } = await params;
	const response = await dispatch(request, path.join("/"), {
		env: env as AdminEnv,
		defer: (work) => void waitUntil(work),
		media: env.MEDIA ? r2Store(env.MEDIA as R2Like) : undefined,
		// The private backup bucket (R2 tlhp-backup), declared with the admin in cloudflare.config.ts.
		backup: env.BACKUP ? (env.BACKUP as BackupBucket) : undefined,
		// SMTP settings are read from D1 on every send; without them the mailer throws and the caller reports it.
		mailer: createSmtpMailer((env as AdminEnv).DB, env as AdminEnv),
	});
	// What the site holds in memory (articles, menus, the home page) is read again from the database after any write that went through.
	if (request.method !== "GET" && request.method !== "HEAD" && response.ok) {
		bumpContentEpoch();
		// And what the edge holds of the public pages is dropped now, not at the next 5-minute renewal. A failure here never undoes the write.
		if (affectsPublicSite(request.method, path.join("/"))) {
			try {
				revalidatePath("/", "layout");
			} catch (error) {
				console.error("admin: dropping the public pages' cache failed", error);
			}
		}
	}
	return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
