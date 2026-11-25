// Hàm thuần cho nút phần trăm cuộn trang (ScrollProgressButton): không đụng DOM nên kiểm thử được bằng node:test.

/** Phần trăm đã cuộn, số nguyên 0–100. Trang không cuộn được (hoặc số liệu hỏng) trả 0. */
export function scrollPercent(scrollY: number, scrollHeight: number, innerHeight: number): number {
	const range = scrollHeight - innerHeight;
	if (!Number.isFinite(scrollY) || !Number.isFinite(range) || range <= 0) return 0;
	const p = Math.round((scrollY / range) * 100);
	return Math.min(100, Math.max(0, p));
}

/** Quãng cuộn (px) tối thiểu trước khi nút hiện, để không che nội dung ở đầu trang. */
export const SCROLL_BUTTON_THRESHOLD = 240;

/** Nút hiện ở mọi trang cuộn được, sau khi đã cuộn quá ngưỡng nhỏ. Trang không cuộn được thì không hiện. */
export function shouldShowScrollButton(scrollY: number, scrollHeight: number, innerHeight: number, threshold = SCROLL_BUTTON_THRESHOLD): boolean {
	if (!(innerHeight > 0) || !(scrollHeight - innerHeight > 0)) return false;
	return scrollY > threshold;
}

/** Phần bù (px) để nút nổi nằm trên cao hơn mọi phần tử cố định ở góc dưới phải. `tops` là mép trên (px từ đỉnh khung nhìn) của các phần tử đó. */
export function bottomOffsetFor(tops: readonly number[], innerHeight: number, baseBottom: number, gap = 12): number {
	let offset = 0;
	for (const top of tops) {
		if (!Number.isFinite(top)) continue;
		const needed = innerHeight - top + gap - baseBottom;
		if (needed > offset) offset = needed;
	}
	return Math.max(0, Math.ceil(offset));
}
