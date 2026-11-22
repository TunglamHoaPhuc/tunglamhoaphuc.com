"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The old site's key (WelcomeNoticeModal), so a reader who closed it there is not asked again
// once www moves to this site.
const STORAGE_KEY = "tlhp_welcome_notice_v1_0";
// As the old site: the notice comes a moment after the page, not over its first paint.
const DELAY_MS = 1000;

function hasSeen(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== null;
	} catch {
		// Storage blocked (private mode, site data off): show it, as on a first visit.
		return false;
	}
}

function markSeen() {
	try {
		localStorage.setItem(STORAGE_KEY, "seen");
	} catch {
		// Nothing to keep it in: the notice shows again on the next visit.
	}
}

/**
 * The welcome notice of the first digital edition, from the old home page
 * (src/components/public/modals/WelcomeNoticeModal.tsx of the old site). A native modal
 * <dialog>: the page behind is inert, focus stays inside, Esc and the X close it.
 * Asked for by the owner (22/11/2026), so the one pop-up the site has.
 */
export default function WelcomeNotice() {
	const [open, setOpen] = useState(false);
	const [dontShowAgain, setDontShowAgain] = useState(true);
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		if (hasSeen()) return;
		// Asked again at the end: the notice may have been closed in another tab meanwhile.
		const timer = window.setTimeout(() => setOpen(!hasSeen()), DELAY_MS);
		return () => window.clearTimeout(timer);
	}, []);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (open && dialog && !dialog.open) dialog.showModal();
	}, [open]);

	const close = useCallback(() => {
		if (dontShowAgain) markSeen();
		dialogRef.current?.close();
		setOpen(false);
	}, [dontShowAgain]);

	if (!open) return null;

	return (
		<dialog
			ref={dialogRef}
			className="tlhp-welcome-notice"
			aria-labelledby="tlhp-welcome-notice-title"
			aria-describedby="tlhp-welcome-notice-body"
			onCancel={(event) => {
				event.preventDefault();
				close();
			}}
		>
			<div className="tlhp-welcome-notice__card">
				<span className="tlhp-welcome-notice__corner tlhp-welcome-notice__corner--tl" aria-hidden="true" />
				<span className="tlhp-welcome-notice__corner tlhp-welcome-notice__corner--tr" aria-hidden="true" />
				<span className="tlhp-welcome-notice__corner tlhp-welcome-notice__corner--bl" aria-hidden="true" />
				<span className="tlhp-welcome-notice__corner tlhp-welcome-notice__corner--br" aria-hidden="true" />

				<button type="button" className="tlhp-welcome-notice__close" onClick={close} aria-label="Đóng thông báo">
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>

				<header className="tlhp-welcome-notice__head">
					<div className="tlhp-welcome-notice__wheel" aria-hidden="true">
						<span>☸</span>
					</div>
					<p className="tlhp-welcome-notice__badge">ẤN BẢN SỐ HÓA V1.0.0 (XUẤT BẢN LẦN THỨ NHẤT)</p>
					<h2 id="tlhp-welcome-notice-title" className="tlhp-welcome-notice__title">
						KÍNH MỪNG QUÝ PHẬT TỬ &amp; ĐẠI CHÚNG
					</h2>
				</header>

				<div id="tlhp-welcome-notice-body" className="tlhp-welcome-notice__body">
					<p className="tlhp-welcome-notice__homage">Nam Mô Bổn Sư Thích Ca Mâu Ni Phật!</p>
					<p>Kính bạch Chư Tôn Đức Tăng Ni, kính thưa quý thiện nam tín nữ Phật tử và quý bạn đọc thập phương,</p>
					<div className="tlhp-welcome-notice__quote">
						<p>
							Nhằm phụng sự Chánh pháp và mở rộng nhịp cầu kết nối truyền thông hoằng pháp trong thời đại số, Ban Biên tập và Đạo tràng Tùng Lâm Hòa Phúc trân trọng ra mắt Cổng thông tin điện tử chính thức của bổn tự (Phiên bản thử nghiệm 1.0.0).
						</p>
						<p className="tlhp-welcome-notice__note">
							* Vì đây là ấn bản số hóa phát hành lần thứ nhất, khối lượng dữ liệu lịch sử, hình ảnh và tư liệu giáo lý đang trong quá trình đối chiếu, chuẩn hóa và tiếp tục bổ sung. Kính mong Chư Tôn Đức cùng quý đại chúng từ bi hoan hỷ lượng thứ cho những thiếu sót ban đầu và hoan hỷ gửi ý kiến đóng góp quý báu để bổn tự ngày một hoàn thiện trang nghiêm hơn.
						</p>
					</div>
					<p className="tlhp-welcome-notice__wish">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762" />
						</svg>
						<span>Kính chúc quý vị và gia quyến thân tâm thường lạc, vạn sự hanh thông, Bồ Đề tâm kiên cố!</span>
					</p>
				</div>

				<footer className="tlhp-welcome-notice__foot">
					<label className="tlhp-welcome-notice__check">
						<input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} />
						<span>Không hiển thị lại thông báo này</span>
					</label>
					<button type="button" className="tlhp-welcome-notice__go" onClick={close}>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M20 6 9 17l-5-5" />
						</svg>
						<span>Hoan Hỷ Tiếp Tục</span>
					</button>
				</footer>
			</div>
		</dialog>
	);
}
