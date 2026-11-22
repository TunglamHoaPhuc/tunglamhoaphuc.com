// Operations: /dashboard, /audit, /trash, /seo, /redirects, /settings, /backup (docs/admin-architecture.md 7.7).
import { z } from "zod";
import { hit } from "../auth/throttle";
import { ApiError } from "../http/errors";
import { registerRoutes, type Call } from "../http/api";
import { listResponse, pageOf } from "../http/paging";
import { MailError, MAIL_MESSAGES } from "../mail/smtp";
import { auditPageSize, getAudit, listAudit } from "./audit";
import { confirmPassword, downloadStored, exportDownload, listBackups, runBackup, type BackupBucket } from "./backup";
import { audit, requireSuperAdmin } from "./common";
import { dashboard } from "./dashboard";
import { createRedirect, deleteRedirect, getRedirect, importInput, importRedirects, listRedirects, redirectInput, redirectPatch, updateRedirect } from "./redirects";
import { getSeoDefaults, putSeoDefaults, seoSchema } from "./seo";
import { readGroup, writeGroup } from "./settings";
import { listTrash, purgeTrashed, restoreTrashed, trashTypes } from "./trash";

const bucket = (call: Call): BackupBucket => {
	if (!call.deps.backup) throw new ApiError(503, "no_backup_bucket", "Chưa gắn kho lưu trữ sao lưu (R2 tlhp-backup) cho máy chủ này.");
	return call.deps.backup;
};

registerRoutes(
	// ---------------------------------------------------------------- dashboard
	{ method: "GET", path: "dashboard", needs: { module: "dashboard", action: "view" }, handler: async (call) => dashboard(call.ctx, call.authed!) },

	// ---------------------------------------------------------------- activity log (read only)
	{
		method: "GET",
		path: "audit",
		needs: { module: "audit", action: "view" },
		handler: async (call) => {
			const page = pageOf(call.query, auditPageSize, auditPageSize);
			const q = call.query;
			const { rows, total } = await listAudit(
				call.ctx,
				{ userId: q.get("userId") ?? undefined, action: q.get("action") ?? undefined, entityType: q.get("entityType") ?? undefined, entityId: q.get("entityId") ?? undefined, from: q.get("from") ?? undefined, to: q.get("to") ?? undefined, ip: q.get("ip") ?? undefined, q: q.get("q")?.trim() || undefined },
				page,
			);
			return listResponse(rows, page, total);
		},
	},
	{ method: "GET", path: "audit/:id", needs: { module: "audit", action: "view" }, handler: async (call) => getAudit(call.ctx, call.params.id) },

	// ---------------------------------------------------------------- trash
	{ method: "GET", path: "trash/types", needs: { module: "trash", action: "view" }, own: true, handler: async (call) => ({ types: trashTypes(call.authed!) }) },
	{
		method: "GET",
		path: "trash",
		needs: { module: "trash", action: "view" },
		own: true,
		handler: async (call) => {
			const page = pageOf(call.query, 25, 100);
			const { rows, total } = await listTrash(call.ctx, call.authed!, { type: call.query.get("type") || undefined }, page);
			return listResponse(rows, page, total);
		},
	},
	{ method: "POST", path: "trash/:type/:id/restore", needs: { module: "trash", action: "update" }, own: true, handler: async (call) => restoreTrashed(call.ctx, call.authed!, call.params.type, call.params.id) },
	{
		method: "DELETE",
		path: "trash/:type/:id",
		needs: { module: "trash", action: "delete" },
		own: true,
		handler: async (call) => {
			await purgeTrashed(call.ctx, call.authed!, call.params.type, call.params.id, call.deps.media);
		},
	},

	// ---------------------------------------------------------------- SEO
	{ method: "GET", path: "seo/defaults", needs: { module: "seo", action: "view" }, handler: async (call) => getSeoDefaults(call.ctx) },
	{ method: "PUT", path: "seo/defaults", needs: { module: "seo", action: "update" }, handler: async (call) => putSeoDefaults(call.ctx, call.authed!, await call.body(seoSchema)) },

	// ---------------------------------------------------------------- redirects
	{
		method: "GET",
		path: "redirects",
		needs: { module: "redirects", action: "view" },
		handler: async (call) => {
			const page = pageOf(call.query, 50, 100);
			const { rows, total } = await listRedirects(call.ctx, { q: call.query.get("q")?.trim() || undefined, active: call.query.get("active") ?? undefined }, page);
			return listResponse(rows, page, total);
		},
	},
	{ method: "POST", path: "redirects", needs: { module: "redirects", action: "create" }, handler: async (call) => createRedirect(call.ctx, call.authed!, await call.body(redirectInput)) },
	{ method: "POST", path: "redirects/import", needs: { module: "redirects", action: "create" }, handler: async (call) => importRedirects(call.ctx, call.authed!, (await call.body(importInput)).rows) },
	{ method: "GET", path: "redirects/:id", needs: { module: "redirects", action: "view" }, handler: async (call) => getRedirect(call.ctx, call.params.id) },
	{
		method: "PATCH",
		path: "redirects/:id",
		needs: { module: "redirects", action: "update" },
		handler: async (call) => updateRedirect(call.ctx, call.authed!, call.params.id, await call.body(redirectPatch)),
	},
	{
		method: "DELETE",
		path: "redirects/:id",
		needs: { module: "redirects", action: "delete" },
		handler: async (call) => {
			await deleteRedirect(call.ctx, call.authed!, call.params.id);
		},
	},

	// ---------------------------------------------------------------- settings
	{
		method: "POST",
		path: "settings/smtp/test",
		needs: { module: "settings", action: "update" },
		handler: async (call) => {
			const by = call.authed!;
			requireSuperAdmin(by);
			if (!(await hit(call.ctx.db, `smtp-test:${by.user.id}`, call.ctx.now(), 5, 10 * 60_000))) throw new ApiError(429, "too_many_attempts", "Bạn gửi thư thử quá nhiều lần. Hãy đợi vài phút.", undefined, 600);
			let failure: string | null = null;
			try {
				await call.deps.mailer({ to: by.user.email, subject: "Thư thử từ trang quản trị Tùng Lâm Hòa Phúc", text: "Đây là thư thử. Nếu bạn đọc được thư này thì máy chủ thư đã được cấu hình đúng." });
			} catch (error) {
				failure = error instanceof MailError ? error.message : MAIL_MESSAGES.connect;
			}
			await audit(call.ctx, by, { action: "settings.smtp_test", entityType: "setting", entityId: "mail.smtp", after: { to: by.user.email, ok: failure === null } }).run();
			if (failure) throw new ApiError(502, "mail_failed", failure);
			return { ok: true, to: by.user.email };
		},
	},
	{ method: "GET", path: "settings/:group", needs: { module: "settings", action: "view" }, handler: async (call) => readGroup(call.ctx, call.authed!, call.params.group) },
	{ method: "PUT", path: "settings/:group", needs: { module: "settings", action: "update" }, handler: async (call) => writeGroup(call.ctx, call.authed!, call.params.group, (schema) => call.body(schema)) },

	// ---------------------------------------------------------------- backup
	{
		method: "POST",
		path: "backup/export",
		needs: { module: "backup", action: "create" },
		handler: async (call) => {
			const { password } = await call.body(z.object({ password: z.string().min(1, "Nhập mật khẩu của bạn.").max(200) }));
			await confirmPassword(call.ctx, call.authed!, password);
			return exportDownload(call.ctx, call.authed!);
		},
	},
	{ method: "POST", path: "backup/run", needs: { module: "backup", action: "create" }, handler: async (call) => runBackup(call.ctx, call.authed!, bucket(call)) },
	{
		method: "GET",
		path: "backup",
		needs: { module: "backup", action: "view" },
		handler: async (call) => (call.deps.backup ? { configured: true, backups: await listBackups(call.deps.backup) } : { configured: false, backups: [] }),
	},
	{ method: "GET", path: "backup/:name/download", needs: { module: "backup", action: "view" }, handler: async (call) => downloadStored(call.ctx, call.authed!, bucket(call), call.params.name) },
);
