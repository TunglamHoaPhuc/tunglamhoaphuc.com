// /users, /roles, /permissions and PATCH /me (docs/admin-architecture.md 7.2).
import { z } from "zod";
import { listSessions } from "../auth/service";
import { registerRoutes } from "../http/api";
import { listResponse, pageOf } from "../http/paging";
import { ACTIONS, MODULES } from "../rbac/catalog";
import {
	createRole, createUser, deleteRole, deleteUser, forcePasswordChange, getRole, getUser, listRoles, listUsers, resetTwoFactor, revokeUserSessions,
	setLocked, updateRole, updateUser,
} from "./service";

const email = z.string().trim().min(3, "Nhập email.").max(200).includes("@", { message: "Email chưa đúng." });
const name = z.string().trim().min(1, "Nhập họ tên.").max(120);
const permissions = z.array(z.string().max(60)).max(200);

registerRoutes(
	{
		method: "GET",
		path: "users",
		needs: { module: "users", action: "view" },
		handler: async (call) => {
			const page = pageOf(call.query);
			const { rows, total } = await listUsers(call.ctx, { q: call.query.get("q") ?? undefined, roleId: call.query.get("roleId") ?? undefined, status: call.query.get("status") ?? undefined }, page);
			return listResponse(rows, page, total);
		},
	},
	{ method: "GET", path: "users/:id", needs: { module: "users", action: "view" }, handler: async (call) => getUser(call.ctx, call.params.id) },
	{
		method: "POST",
		path: "users",
		needs: { module: "users", action: "create" },
		handler: async (call) => createUser(call.ctx, call.authed!, await call.body(z.object({ email, name, roleId: z.string().min(1, "Chọn vai trò.") }))),
	},
	{
		method: "PATCH",
		path: "users/:id",
		needs: { module: "users", action: "update" },
		handler: async (call) => {
			const input = await call.body(z.object({ email: email.optional(), name: name.optional(), roleId: z.string().min(1).optional() }));
			const { user, oldEmail } = await updateUser(call.ctx, call.authed!, call.params.id, input);
			if (oldEmail) {
				// The address that lost the account is told, after the answer has gone out.
				call.deps.defer(
					call.deps
						.mailer({ to: oldEmail, subject: "Email đăng nhập quản trị đã được đổi", text: `Email của tài khoản quản trị Tùng Lâm Hòa Phúc đã được đổi thành ${user.email}. Nếu bạn không biết về việc này, hãy liên hệ người quản trị ngay.` })
						.catch((error) => console.error("email-change notice failed", error)),
				);
			}
			return user;
		},
	},
	{
		method: "POST",
		path: "users/:id/lock",
		needs: { module: "users", action: "update" },
		handler: async (call) => setLocked(call.ctx, call.authed!, call.params.id, true, (await call.body(z.object({ reason: z.string().trim().max(200).default("") }))).reason),
	},
	{ method: "POST", path: "users/:id/unlock", needs: { module: "users", action: "update" }, handler: async (call) => setLocked(call.ctx, call.authed!, call.params.id, false) },
	{ method: "POST", path: "users/:id/force-password-change", needs: { module: "users", action: "update" }, handler: async (call) => forcePasswordChange(call.ctx, call.authed!, call.params.id) },
	{
		method: "POST",
		path: "users/:id/reset-2fa",
		needs: { module: "users", action: "update" },
		handler: async (call) => {
			await resetTwoFactor(call.ctx, call.authed!, call.params.id);
		},
	},
	{
		method: "GET",
		path: "users/:id/sessions",
		needs: { module: "users", action: "update" },
		handler: async (call) => {
			await getUser(call.ctx, call.params.id);
			return { sessions: await listSessions(call.ctx, call.params.id) };
		},
	},
	{
		method: "DELETE",
		path: "users/:id/sessions",
		needs: { module: "users", action: "update" },
		handler: async (call) => ({ ended: await revokeUserSessions(call.ctx, call.authed!, call.params.id) }),
	},
	{
		method: "DELETE",
		path: "users/:id",
		needs: { module: "users", action: "delete" },
		handler: async (call) => {
			await deleteUser(call.ctx, call.authed!, call.params.id);
		},
	},

	{ method: "GET", path: "roles", needs: { module: "roles", action: "view" }, handler: async (call) => ({ roles: await listRoles(call.ctx) }) },
	{ method: "GET", path: "roles/:id", needs: { module: "roles", action: "view" }, handler: async (call) => getRole(call.ctx, call.params.id) },
	{
		method: "GET",
		path: "permissions",
		needs: { module: "roles", action: "view" },
		handler: async () => ({ modules: Object.entries(MODULES).map(([key, label]) => ({ key, label })), actions: ACTIONS }),
	},
	{
		method: "POST",
		path: "roles",
		needs: { module: "roles", action: "create" },
		handler: async (call) => createRole(call.ctx, call.authed!, await call.body(z.object({ name: z.string().trim().min(2, "Nhập tên vai trò.").max(60), description: z.string().trim().max(200).default(""), permissions }))),
	},
	{
		method: "PATCH",
		path: "roles/:id",
		needs: { module: "roles", action: "update" },
		handler: async (call) => updateRole(call.ctx, call.authed!, call.params.id, await call.body(z.object({ name: z.string().trim().min(2).max(60).optional(), description: z.string().trim().max(200).optional(), permissions: permissions.optional() }))),
	},
	{
		method: "DELETE",
		path: "roles/:id",
		needs: { module: "roles", action: "delete" },
		handler: async (call) => {
			await deleteRole(call.ctx, call.authed!, call.params.id);
		},
	},

	{
		method: "PATCH",
		path: "me",
		needs: "session-any",
		handler: async (call) => {
			const input = await call.body(z.object({ name }));
			await call.ctx.db.prepare("UPDATE user SET name = ?, updated_at = ? WHERE id = ?").bind(input.name, call.ctx.now().toISOString(), call.authed!.user.id).run();
			return { name: input.name };
		},
	},
);
