// /home (docs/admin-architecture.md 7.7): the blocks of the home page, with drafts.
import { z } from "zod";
import { registerRoutes } from "../http/api";
import { forbidden } from "../http/errors";
import { can } from "../rbac/check";
import { discardDraft, getHome, publishDraft, saveBlock } from "./home";

registerRoutes(
	{ method: "GET", path: "home", needs: { module: "home", action: "view" }, handler: async (call) => getHome(call.ctx) },
	{
		method: "PUT",
		path: "home/:block",
		needs: { module: "home", action: "update" },
		handler: async (call) => {
			const input = await call.body(z.object({ value: z.unknown(), publish: z.boolean().optional() }));
			const publish = input.publish === true;
			if (publish && !can(call.authed!.permissions, "home", "publish")) throw forbidden();
			return saveBlock(call.ctx, call.authed!, call.params.block, input.value, publish);
		},
	},
	{ method: "POST", path: "home/:block/publish", needs: { module: "home", action: "publish" }, handler: async (call) => publishDraft(call.ctx, call.authed!, call.params.block) },
	{ method: "DELETE", path: "home/:block/draft", needs: { module: "home", action: "update" }, handler: async (call) => discardDraft(call.ctx, call.authed!, call.params.block) },
);
