// /media and /media/folders (docs/admin-architecture.md 7.5). Uploads are multipart: the file, plus a few text fields.
import { z } from "zod";
import { registerRoutes, type Call } from "../http/api";
import { ApiError } from "../http/errors";
import { listResponse, pageOf } from "../http/paging";
import { MAX_IMAGE_BYTES } from "./files";
import {
	createFolder, deleteCrop, deleteFolder, deleteMedia, getMedia, listFolders, listMedia, mediaStats, replaceMediaFile, saveCrop, updateFolder, updateMedia, uploadMedia,
} from "./service";

const nullableId = z.string().max(80).nullable().optional();

/** The one file of a multipart request, and its other fields. */
async function readUpload(call: Call): Promise<{ bytes: Uint8Array; filename: string; fields: FormData }> {
	const type = call.request.headers.get("content-type") ?? "";
	if (!/^multipart\/form-data\b/i.test(type)) throw new ApiError(415, "multipart_required", "Cần gửi ảnh dạng multipart/form-data.");
	const length = Number(call.request.headers.get("content-length"));
	if (Number.isFinite(length) && length > MAX_IMAGE_BYTES + 1_000_000) throw new ApiError(413, "too_large", "Ảnh lớn hơn 15 MB. Hãy thu nhỏ ảnh rồi tải lại.");
	let form: FormData;
	try {
		form = await call.request.formData();
	} catch {
		throw new ApiError(400, "bad_upload", "Không đọc được tệp tải lên.");
	}
	const file = form.get("file");
	if (!(file instanceof File)) throw new ApiError(400, "invalid_input", "Chưa chọn ảnh.", { file: "Chưa chọn ảnh." });
	return { bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name, fields: form };
}

const field = (form: FormData, name: string) => {
	const value = form.get(name);
	return typeof value === "string" ? value : undefined;
};

function store(call: Call) {
	if (!call.deps.media) throw new ApiError(503, "no_storage", "Kho ảnh chưa được cấu hình trên máy chủ này.");
	return call.deps.media;
}

registerRoutes(
	{
		method: "GET",
		path: "media",
		needs: { module: "media", action: "view" },
		handler: async (call) => {
			const page = pageOf(call.query, 40, 100);
			const { rows, total } = await listMedia(
				call.ctx,
				{ folderId: call.query.get("folderId") ?? undefined, q: call.query.get("q") ?? undefined, unused: call.query.get("unused") === "1", sort: call.query.get("sort") ?? undefined },
				page,
			);
			return listResponse(rows, page, total);
		},
	},
	{ method: "GET", path: "media/stats", needs: { module: "media", action: "view" }, handler: async (call) => mediaStats(call.ctx) },
	{ method: "GET", path: "media/folders", needs: { module: "media", action: "view" }, handler: async (call) => listFolders(call.ctx) },
	{
		method: "POST",
		path: "media/folders",
		needs: { module: "media", action: "create" },
		handler: async (call) => createFolder(call.ctx, call.authed!, await call.body(z.object({ name: z.string().trim().min(1, "Nhập tên thư mục.").max(60), parentId: nullableId }))),
	},
	{
		method: "PATCH",
		path: "media/folders/:id",
		needs: { module: "media", action: "update" },
		handler: async (call) => {
			await updateFolder(call.ctx, call.authed!, call.params.id, await call.body(z.object({ name: z.string().trim().min(1).max(60).optional(), parentId: nullableId })));
		},
	},
	{
		method: "DELETE",
		path: "media/folders/:id",
		needs: { module: "media", action: "delete" },
		handler: async (call) => {
			await deleteFolder(call.ctx, call.authed!, call.params.id);
		},
	},
	{
		method: "POST",
		path: "media",
		needs: { module: "media", action: "create" },
		handler: async (call) => {
			const { bytes, filename, fields } = await readUpload(call);
			return uploadMedia(call.ctx, call.authed!, store(call), {
				bytes,
				filename,
				folderId: field(fields, "folderId") || null,
				alt: field(fields, "alt"),
				title: field(fields, "title"),
				allowDuplicate: field(fields, "allowDuplicate") === "1",
			});
		},
	},
	{ method: "GET", path: "media/:id", needs: { module: "media", action: "view" }, handler: async (call) => getMedia(call.ctx, call.params.id) },
	{
		method: "PATCH",
		path: "media/:id",
		needs: { module: "media", action: "update" },
		own: true,
		handler: async (call) =>
			updateMedia(call.ctx, call.authed!, call.params.id, await call.body(z.object({ alt: z.string().max(300).optional(), title: z.string().max(200).optional(), caption: z.string().max(500).optional(), folderId: nullableId }))),
	},
	{
		method: "PUT",
		path: "media/:id/file",
		needs: { module: "media", action: "update" },
		own: true,
		handler: async (call) => {
			const { bytes, filename } = await readUpload(call);
			return replaceMediaFile(call.ctx, call.authed!, store(call), call.params.id, { bytes, filename });
		},
	},
	{
		method: "PUT",
		path: "media/:id/crops/:ratio",
		needs: { module: "media", action: "update" },
		own: true,
		handler: async (call) => {
			const { bytes, fields } = await readUpload(call);
			let region: unknown;
			try {
				region = JSON.parse(field(fields, "region") ?? "");
			} catch {
				throw new ApiError(400, "invalid_input", "Thiếu vùng cắt.", { region: "Thiếu vùng cắt." });
			}
			const parsed = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).safeParse(region);
			if (!parsed.success) throw new ApiError(400, "invalid_input", "Vùng cắt không hợp lệ.", { region: "Vùng cắt không hợp lệ." });
			return saveCrop(call.ctx, call.authed!, store(call), call.params.id, decodeURIComponent(call.params.ratio), { bytes, region: parsed.data });
		},
	},
	{
		method: "DELETE",
		path: "media/:id/crops/:ratio",
		needs: { module: "media", action: "update" },
		own: true,
		handler: async (call) => {
			await deleteCrop(call.ctx, call.authed!, store(call), call.params.id, decodeURIComponent(call.params.ratio));
		},
	},
	{
		method: "DELETE",
		path: "media/:id",
		needs: { module: "media", action: "delete" },
		own: true,
		handler: async (call) => {
			await deleteMedia(call.ctx, call.authed!, call.params.id, call.query.get("force") === "1");
		},
	},
);
