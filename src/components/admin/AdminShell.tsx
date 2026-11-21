"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AdminProvider, useAdmin } from "./AdminProvider";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { Alert, Button } from "./ui";

type NavItem = { href: string; label: string; needs?: [string, string] };

// Only what exists is listed; each module adds its links here when it lands.
const NAV: { group?: string; items: NavItem[] }[] = [
	{ items: [{ href: "/quan-tri", label: "Tổng quan" }] },
	{ group: "Nội dung", items: [{ href: "/quan-tri/media", label: "Thư viện Media", needs: ["media", "view"] }] },
	{
		group: "Hệ thống",
		items: [
			{ href: "/quan-tri/tai-khoan", label: "Tài khoản", needs: ["users", "view"] },
			{ href: "/quan-tri/vai-tro", label: "Vai trò và quyền", needs: ["roles", "view"] },
		],
	},
	{ group: "Của tôi", items: [{ href: "/quan-tri/ho-so", label: "Hồ sơ và bảo mật" }] },
];

function isCurrent(pathname: string, href: string) {
	return href === "/quan-tri" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function Frame({ children }: { children: ReactNode }) {
	const { me, can, signOut, reload } = useAdmin();
	const pathname = usePathname();
	const [open, setOpen] = useState(false);

	if (me.mustChangePassword) {
		return (
			<div className="tq-center">
				<div className="tq-card tq-card--narrow">
					<h1 className="tq-h1" style={{ marginBottom: 12 }}>Đổi mật khẩu để tiếp tục</h1>
					<Alert kind="warning">Tài khoản này đang dùng mật khẩu tạm hoặc được yêu cầu đổi mật khẩu. Hãy đặt mật khẩu mới của riêng bạn.</Alert>
					<ChangePasswordForm onDone={() => void reload()} />
					<p style={{ marginTop: 16, marginBottom: 0 }}><Button variant="link" onClick={() => void signOut()}>Đăng xuất</Button></p>
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="tq-topbar">
				<strong>Quản trị Tùng Lâm Hòa Phúc</strong>
				<Button variant="secondary" aria-expanded={open} aria-controls="tq-side" onClick={() => setOpen(!open)}>Menu</Button>
			</div>
			<div className="tq-shell">
				<aside className="tq-side" id="tq-side" data-open={open} aria-label="Menu quản trị">
					<div className="tq-brand">
						<img src="/brand/logo-tung-lam-hoa-phuc-tron-nga.webp" alt="" width={44} height={44} />
						<div>
							<strong>Tùng Lâm Hòa Phúc</strong>
							<span>Trang quản trị</span>
						</div>
					</div>
					<nav>
						{NAV.map((group) => {
							const items = group.items.filter((item) => !item.needs || can(item.needs[0], item.needs[1]));
							if (!items.length) return null;
							return (
								<div key={group.group ?? "main"}>
									{group.group ? <p className="tq-nav-group">{group.group}</p> : null}
									<ul className="tq-nav">
										{items.map((item) => (
											<li key={item.href}>
												<Link href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}</Link>
											</li>
										))}
									</ul>
								</div>
							);
						})}
					</nav>
					<div className="tq-side-foot">
						<div><strong>{me.user.name || me.user.email}</strong></div>
						<div>{me.user.role}</div>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => void signOut()}>Đăng xuất</button>
					</div>
				</aside>
				<main className="tq-main" id="noi-dung">{children}</main>
			</div>
		</>
	);
}

export function AdminShell({ children }: { children: ReactNode }) {
	return (
		<AdminProvider>
			<Frame>{children}</Frame>
		</AdminProvider>
	);
}
