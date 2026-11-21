/** An error the API turns into `{ error: { code, message, fields? } }` with this status. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly fields?: Record<string, string>,
		/** Seconds the caller should wait (sent as Retry-After). */
		readonly retryAfter?: number,
	) {
		super(message);
	}
}

export const forbidden = () => new ApiError(403, "forbidden", "Bạn không có quyền thực hiện thao tác này.");
export const unauthorized = () => new ApiError(401, "unauthorized", "Bạn cần đăng nhập.");
export const notFound = (what = "Mục này") => new ApiError(404, "not_found", `${what} không tồn tại.`);
