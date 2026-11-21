"use client";

import Link from "next/link";
import { useAdmin } from "@/components/admin/AdminProvider";
import { PageHeader } from "@/components/admin/ui";

// The real dashboard (counts, pending posts, upcoming retreats) arrives with the "van-hanh" module.
export default function DashboardPage() {
	const { me, can } = useAdmin();
	return (
		<>
			<PageHeader title={`Xin chào, ${me.user.name || me.user.email}`} />
			<p className="tq-muted">Vai trò của bạn: <strong>{me.user.role}</strong>.</p>
			<div className="tq-grid">
				{can("users", "view") ? (
					<section className="tq-panel">
						<h2 className="tq-h2">Tài khoản</h2>
						<p className="tq-muted">Thêm, khóa, đổi vai trò, xem phiên đăng nhập.</p>
						<Link href="/quan-tri/tai-khoan">Mở danh sách tài khoản</Link>
					</section>
				) : null}
				{can("roles", "view") ? (
					<section className="tq-panel">
						<h2 className="tq-h2">Vai trò và quyền</h2>
						<p className="tq-muted">Xem ma trận quyền, tạo vai trò riêng.</p>
						<Link href="/quan-tri/vai-tro">Mở danh sách vai trò</Link>
					</section>
				) : null}
				<section className="tq-panel">
					<h2 className="tq-h2">Hồ sơ và bảo mật</h2>
					<p className="tq-muted">Đổi mật khẩu, bật xác thực hai bước, xem thiết bị đang đăng nhập.</p>
					<Link href="/quan-tri/ho-so">Mở hồ sơ</Link>
				</section>
			</div>
		</>
	);
}
