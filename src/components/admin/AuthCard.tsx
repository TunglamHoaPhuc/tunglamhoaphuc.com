import type { ReactNode } from "react";

/** The centred card the sign-in, forgot-password and reset-password pages sit in. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
	return (
		<main className="tq-center">
			<div className="tq-card tq-card--narrow">
				<div className="tq-brand">
					<img src="/brand/logo-tung-lam-hoa-phuc-tron-nga.webp" alt="" width={44} height={44} />
					<div>
						<strong>Tùng Lâm Hòa Phúc</strong>
						<span>Trang quản trị</span>
					</div>
				</div>
				<h1 className="tq-h1" style={{ marginBottom: 16 }}>{title}</h1>
				{children}
			</div>
		</main>
	);
}
