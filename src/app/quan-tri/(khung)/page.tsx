"use client";

import { useAdmin } from "@/components/admin/AdminProvider";
import { PageHeader } from "@/components/admin/ui";
import { DashboardView } from "@/components/admin/ops/DashboardView";
import Link from "next/link";

// People whose role has no "Tổng quan" right still get a start page with their own profile.
export default function DashboardPage() {
	const { can, me } = useAdmin();
	if (can("dashboard", "view")) return <DashboardView />;
	return (
		<>
			<PageHeader title={`Xin chào, ${me.user.name || me.user.email}`} />
			<p className="tq-muted">Vai trò của bạn: <strong>{me.user.role}</strong>.</p>
			<section className="tq-panel">
				<h2 className="tq-h2">Hồ sơ và bảo mật</h2>
				<p className="tq-muted">Đổi mật khẩu, bật xác thực hai bước, xem thiết bị đang đăng nhập.</p>
				<Link href="/quan-tri/ho-so">Mở hồ sơ</Link>
			</section>
		</>
	);
}
