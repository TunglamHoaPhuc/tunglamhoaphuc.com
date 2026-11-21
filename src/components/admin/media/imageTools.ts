// Browser-side helpers of the media library: preparing a picture before it is sent, cutting a crop, the multipart
// call (api.ts only speaks JSON), the shared types and the small hooks the library screens use.
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "../api";
import { errorText } from "../ui";

// ------------------------------------------------------------------ types (the API's answers)

export type MediaItem = {
	id: string;
	url: string;
	thumbUrl: string;
	filename: string;
	title: string;
	alt: string;
	caption: string;
	mime: string;
	width: number | null;
	height: number | null;
	sizeBytes: number | null;
	folderId: string | null;
	version: number;
	usageCount: number;
	createdAt: string | null;
	uploadedBy: string | null;
	source: "cms" | "imported";
};

export type MediaUsage = { entityType: string; entityId: string; field: string };
export type MediaCrop = { ratio: string; x: number; y: number; width: number; height: number; url: string };
export type MediaDetailData = MediaItem & { usage: MediaUsage[]; crops: MediaCrop[] };

export type Folder = { id: string; parentId: string | null; name: string; slug: string; position: number; count: number };
export type FolderList = { folders: Folder[]; noFolder: number };

export type MediaStats = {
	total: { count: number; bytes: number; withoutSize: number };
	library: { count: number; bytes: number };
	unused: { count: number; bytes: number };
	byYear: { year: string; count: number; bytes: number }[];
	byFolder: { folderId: string; count: number; bytes: number }[];
};

/** The frame shapes a picture can be cut for, with where each is used. */
export const SHAPES: { ratio: string; label: string; hint: string }[] = [
	{ ratio: "16:9", label: "16:9", hint: "Bìa bài viết, sự kiện" },
	{ ratio: "4:3", label: "4:3", hint: "Thẻ bài, album" },
	{ ratio: "3:4", label: "3:4", hint: "Bảo tượng, chân dung" },
	{ ratio: "16:10", label: "16:10", hint: "Khu vực" },
	{ ratio: "1:1", label: "1:1", hint: "Biểu tượng, ảnh vuông" },
];

export const ratioNumber = (ratio: string): number => {
	const [a, b] = ratio.split(":").map(Number);
	return a && b ? a / b : 1;
};

// ------------------------------------------------------------------ formatting

const numberFormat = new Intl.NumberFormat("vi-VN");
export const formatNumber = (value: number) => numberFormat.format(value);

export function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null) return "—";
	if (bytes < 1024) return `${formatNumber(bytes)} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)} ${units[unit]}`;
}

// ------------------------------------------------------------------ folders

export type FlatFolder = { id: string; name: string; depth: number; label: string };

/** The folders as a flat list in tree order, each with its depth and an indented label for a <select>. */
export function flattenFolders(folders: Folder[]): FlatFolder[] {
	const byParent = new Map<string, Folder[]>();
	const ids = new Set(folders.map((folder) => folder.id));
	for (const folder of folders) {
		// a folder whose parent is missing is shown at the top so it never disappears
		const key = folder.parentId && ids.has(folder.parentId) ? folder.parentId : "";
		byParent.set(key, [...(byParent.get(key) ?? []), folder]);
	}
	const out: FlatFolder[] = [];
	const walk = (parent: string, depth: number) => {
		for (const folder of byParent.get(parent) ?? []) {
			if (depth > 8) continue;
			out.push({ id: folder.id, name: folder.name, depth, label: `${"  ".repeat(depth)}${depth ? "└ " : ""}${folder.name}` });
			walk(folder.id, depth + 1);
		}
	};
	walk("", 0);
	return out;
}

// ------------------------------------------------------------------ preparing a picture

export type PreparedImage = { blob: Blob; name: string; width: number; height: number };

const EXTENSIONS: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const withExtension = (name: string, ext: string) => `${name.replace(/\.[A-Za-z0-9]{1,5}$/, "") || "anh"}.${ext}`;

function mimeOf(file: File): string {
	if (file.type) return file.type;
	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	return EXTENSIONS[ext] ?? "";
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decodeSize(file: File): Promise<{ width: number; height: number }> {
	try {
		const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
		const size = { width: bitmap.width, height: bitmap.height };
		bitmap.close();
		return size;
	} catch {
		return { width: 0, height: 0 };
	}
}

/**
 * Makes a picture ready to upload: JPEG, PNG and WebP are scaled so the longer side is at most `maxSide` and
 * re-encoded as WebP; GIF (maybe animated) and anything that does not get smaller stay as they are.
 */
export async function prepareImage(file: File, opts: { maxSide?: number; quality?: number } = {}): Promise<PreparedImage> {
	const maxSide = opts.maxSide ?? 2560;
	const quality = opts.quality ?? 0.82;
	const mime = mimeOf(file);
	if (!mime.startsWith("image/")) throw new Error(`"${file.name}" không phải là ảnh.`);
	if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) throw new Error(`"${file.name}": chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF.`);
	if (mime === "image/gif") return { blob: file, name: file.name, ...(await decodeSize(file)) };

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		return { blob: file, name: file.name, width: 0, height: 0 };
	}
	try {
		const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) return { blob: file, name: file.name, width: bitmap.width, height: bitmap.height };
		context.drawImage(bitmap, 0, 0, width, height);
		const blob = await toBlob(canvas, "image/webp", quality);
		if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return { blob: file, name: file.name, width: bitmap.width, height: bitmap.height };
		return { blob, name: withExtension(file.name, "webp"), width, height };
	} finally {
		bitmap.close();
	}
}

/** Cuts `region` (percent of the picture) out of a loaded image at its natural resolution, as WebP. */
export async function cropToBlob(image: HTMLImageElement, region: { x: number; y: number; width: number; height: number }, maxWidth = 1920): Promise<Blob> {
	const naturalWidth = image.naturalWidth;
	const naturalHeight = image.naturalHeight;
	if (!naturalWidth || !naturalHeight) throw new Error("Ảnh chưa tải xong. Hãy đợi ảnh hiện rồi cắt.");
	const sx = (region.x / 100) * naturalWidth;
	const sy = (region.y / 100) * naturalHeight;
	const sw = (region.width / 100) * naturalWidth;
	const sh = (region.height / 100) * naturalHeight;
	if (sw < 1 || sh < 1) throw new Error("Vùng cắt quá nhỏ.");
	const width = Math.max(1, Math.min(Math.round(sw), maxWidth));
	const height = Math.max(1, Math.round((width * sh) / sw));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Trình duyệt không cắt được ảnh.");
	context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
	const blob = await toBlob(canvas, "image/webp", 0.85);
	if (!blob) throw new Error("Không tạo được bản cắt. Hãy thử lại.");
	return blob;
}

// ------------------------------------------------------------------ multipart calls

const BASE = "/api/quan-tri/v1";
let csrfToken = "";

async function loadCsrf(): Promise<string> {
	// api() refreshes an expired session by itself, so after a 401 this also renews the cookie.
	const me = await api<{ csrfToken: string }>("GET", "auth/me");
	csrfToken = me.csrfToken;
	return csrfToken;
}

type Envelope = { data?: unknown; error?: { code: string; message: string; fields?: Record<string, string> } };

async function sendForm(method: "POST" | "PUT", path: string, form: FormData): Promise<{ status: number; json: Envelope | null }> {
	let response: Response;
	try {
		// No Content-Type: the browser adds the multipart boundary.
		response = await fetch(`${BASE}/${path}`, { method, body: form, credentials: "same-origin", headers: { "X-TLHP-CSRF": csrfToken } });
	} catch {
		throw new ApiClientError(0, "network", "Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.");
	}
	const text = await response.text();
	try {
		return { status: response.status, json: text ? (JSON.parse(text) as Envelope) : null };
	} catch {
		return { status: response.status, json: null };
	}
}

/** Sends a multipart request (a picture) to /api/quan-tri/v1/<path> and returns the answer's `data`. */
export async function postForm<T>(method: "POST" | "PUT", path: string, form: FormData): Promise<T> {
	if (!csrfToken) await loadCsrf();
	let result = await sendForm(method, path, form);
	const code = result.json?.error?.code;
	if (result.status === 401 || (result.status === 403 && code === "bad_csrf")) {
		await loadCsrf();
		result = await sendForm(method, path, form);
	}
	if (result.status >= 400 || result.json?.error) {
		const error = result.json?.error;
		throw new ApiClientError(result.status, error?.code ?? "server_error", error?.message ?? "Có lỗi ở máy chủ. Hãy thử lại sau.", error?.fields);
	}
	return result.json?.data as T;
}

// ------------------------------------------------------------------ hooks

/**
 * Loads something when `key` changes. The previous answer stays while the next one comes, an answer to an older
 * key (or after unmount) is dropped, and `reload` asks again for the same key.
 */
export function useLoader<T>(load: () => Promise<T>, key: string): { data: T | null; error: string; loading: boolean; reload: () => void } {
	const [attempt, setAttempt] = useState(0);
	const [loaded, setLoaded] = useState<{ key: string; data: T | null; error: string } | null>(null);
	const fullKey = `${key}#${attempt}`;

	useEffect(() => {
		let alive = true;
		load()
			.then((data) => alive && setLoaded({ key: fullKey, data, error: "" }))
			.catch((caught) => alive && setLoaded((old) => ({ key: fullKey, data: old?.data ?? null, error: errorText(caught) })));
		return () => {
			alive = false;
		};
		// The loader is rebuilt on every render; `fullKey` says when the request really changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fullKey]);

	const reload = useCallback(() => setAttempt((n) => n + 1), []);
	const current = loaded !== null && loaded.key === fullKey;
	return { data: loaded?.data ?? null, error: current ? loaded.error : "", loading: !current, reload };
}

/** A value that follows `value` after it has been still for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), ms);
		return () => clearTimeout(timer);
	}, [value, ms]);
	return debounced;
}

/** The page number of a list: it falls back to 1 by itself when `filterKey` (the filters) changes. */
export function usePage(filterKey: string): [number, (page: number) => void] {
	const [state, setState] = useState({ key: filterKey, page: 1 });
	const page = state.key === filterKey ? state.page : 1;
	const setPage = useCallback((next: number) => setState({ key: filterKey, page: next }), [filterKey]);
	return [page, setPage];
}
