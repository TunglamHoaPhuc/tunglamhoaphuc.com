// The icon fields a category and a menu item share: "none", a name from the icon library, a cleaned SVG, or a picture.
// The server decides what is stored: an SVG is cleaned again on every save, whatever the page sent.
import { z } from "zod";
import type { AuthContext } from "../auth/service";
import { text, type AdminStmt } from "../db";
import { ApiError } from "../http/errors";
import { hasIcon } from "../icons/render";
import { MAX_SVG_BYTES, sanitizeSvg, SvgRejected } from "../icons/sanitize";
import { mediaPath, replaceUsageStatements } from "../media/service";

export type IconFields = {
	iconType: "none" | "library" | "svg" | "image";
	iconName: string;
	iconSvg: string;
	iconMediaId: string | null;
	iconUrl: string;
	iconColor: string;
};

export const NO_ICON: IconFields = { iconType: "none", iconName: "", iconSvg: "", iconMediaId: null, iconUrl: "", iconColor: "" };

/** The icon fields as the API takes them (each optional: a save without them keeps the icon). */
export const iconInput = {
	iconType: z.enum(["none", "library", "svg", "image"], { message: "Kiểu icon chưa đúng." }).optional(),
	iconName: z.string().trim().max(60).optional(),
	// A little above the limit, so the person is told "larger than 50 KB" rather than "invalid".
	iconSvg: z.string().max(MAX_SVG_BYTES * 4).optional(),
	iconMediaId: z.string().max(80).nullable().optional(),
	iconUrl: z.string().trim().max(300).optional(),
	iconColor: z.string().trim().max(9).optional(),
};
export type IconPatch = Partial<{ [K in keyof IconFields]: IconFields[K] | undefined }>;

export const iconOf = (row: Record<string, unknown>): IconFields => ({
	iconType: (["library", "svg", "image"].includes(text(row.icon_type)) ? text(row.icon_type) : "none") as IconFields["iconType"],
	iconName: text(row.icon_name),
	iconSvg: text(row.icon_svg),
	iconMediaId: text(row.icon_media_id) || null,
	iconUrl: text(row.icon_url),
	iconColor: text(row.icon_color),
});

const invalid = (field: string, message: string) => new ApiError(400, "invalid_input", message, { [field]: message });

/** A path on this site (/brand/icons/…): one slash first, no scheme, no spaces. */
export const isSitePath = (value: string) => /^\/(?!\/)[A-Za-z0-9._~\-/%]*$/.test(value) && !value.includes("..");

/** The icon to store: `patch` laid over `current`, checked, and with the fields of the other kinds cleared. */
export async function resolveIcon(ctx: AuthContext, patch: IconPatch, current: IconFields = NO_ICON): Promise<IconFields> {
	const merged: IconFields = {
		iconType: patch.iconType ?? current.iconType,
		iconName: patch.iconName ?? current.iconName,
		iconSvg: patch.iconSvg ?? current.iconSvg,
		iconMediaId: patch.iconMediaId === undefined ? current.iconMediaId : patch.iconMediaId,
		iconUrl: patch.iconUrl ?? current.iconUrl,
		iconColor: patch.iconColor ?? current.iconColor,
	};
	if (merged.iconColor && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(merged.iconColor)) throw invalid("iconColor", "Màu icon phải có dạng #RRGGBB, ví dụ #835414.");
	const color = merged.iconColor.toLowerCase();
	switch (merged.iconType) {
		case "none":
			return NO_ICON;
		case "library":
			if (!hasIcon(merged.iconName)) throw invalid("iconName", "Icon này không có trong thư viện. Hãy chọn lại.");
			return { ...NO_ICON, iconType: "library", iconName: merged.iconName, iconColor: color };
		case "svg": {
			// Cleaned again here even if the page already did: the client is never trusted.
			try {
				return { ...NO_ICON, iconType: "svg", iconSvg: sanitizeSvg(merged.iconSvg), iconColor: color };
			} catch (error) {
				if (error instanceof SvgRejected) throw invalid("iconSvg", error.message);
				throw error;
			}
		}
		case "image": {
			if (!merged.iconMediaId && !merged.iconUrl) throw invalid("iconMediaId", "Chưa chọn ảnh cho icon.");
			if (merged.iconMediaId) {
				const found = await ctx.db.prepare("SELECT r2_key, url FROM media WHERE id = ? AND deleted_at IS NULL").bind(merged.iconMediaId).first();
				if (!found) throw invalid("iconMediaId", "Ảnh này không còn trong thư viện.");
				// The picture's address is kept beside its id, so the public site (which reads this row alone) can draw it.
				return { ...NO_ICON, iconType: "image", iconMediaId: merged.iconMediaId, iconUrl: mediaPath(text(found.r2_key) || null, text(found.url) || null), iconColor: color };
			}
			if (!isSitePath(merged.iconUrl)) throw invalid("iconUrl", "Địa chỉ ảnh phải là đường dẫn trong trang, bắt đầu bằng một dấu /.");
			return { ...NO_ICON, iconType: "image", iconUrl: merged.iconUrl, iconColor: color };
		}
	}
}

/** `media_usage` for an entity: the icon picture and, for a category, the picture shared on social networks. */
export function usageStatements(ctx: AuthContext, entityType: string, entityId: string, icon: IconFields, extra: { field: string; mediaId: string | null }[] = []): AdminStmt[] {
	const uses = [{ field: "icon_media_id", mediaId: icon.iconMediaId }, ...extra].filter((use): use is { field: string; mediaId: string } => Boolean(use.mediaId)).map((use) => ({ mediaId: use.mediaId, field: use.field }));
	return replaceUsageStatements(ctx, entityType, entityId, uses);
}

export const iconColumns = (icon: IconFields) => [icon.iconType, icon.iconName, icon.iconSvg, icon.iconMediaId, icon.iconUrl, icon.iconColor];
