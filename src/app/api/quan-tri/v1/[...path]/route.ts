import "@/admin/routes";
import { dispatch } from "@/admin/http/api";
import type { AdminEnv } from "@/admin/db";
import type { MailMessage } from "@/admin/mail/send";

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
	if (!env?.DB || !env.ADMIN_JWT_SECRET || !env.ADMIN_ENC_KEY || !env.ADMIN_BASE_URL) {
		return Response.json({ error: { code: "not_configured", message: "Quản trị chưa được cấu hình trên máy chủ này." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
	}
	const { path } = await params;
	return dispatch(request, path.join("/"), {
		env: env as AdminEnv,
		defer: (work) => void waitUntil(work),
		// The real mailer arrives with the settings module (SMTP); until then a reset mail cannot be sent.
		mailer: async (message: MailMessage) => {
			throw new Error(`SMTP chưa được cấu hình (thư tới ${message.to.length} ký tự bị bỏ)`);
		},
	});
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
