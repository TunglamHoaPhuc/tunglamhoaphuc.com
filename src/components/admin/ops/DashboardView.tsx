"use client";

import Link from "next/link";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader } from "../media/imageTools";
import { Badge, EmptyState, Loading, PageHeader } from "../ui";
import { dayText, formatBytes, LoadError } from "./common";

type Data = {
	posts?: { byStatus: Record<string, number>; total: number; pending: { id: string; title: string; author: string; date: string; link: string }[] };
	events?: { id: string; title: string; startDate: string; endDate: string; location: string }[];
	activity?: { days: { date: string; count: number }[]; total: number };
	media?: { total: { count: number; bytes: number }; library: { count: number; bytes: number }; unused: { count: number; bytes: number } };
	users?: { total: number; locked: number };
};

const STATUS_LABEL: Record<string, string> = { draft: "Bản nháp", pending: "Chờ duyệt", published: "Đã xuất bản", scheduled: "Hẹn giờ đăng", hidden: "Tạm ẩn" };

function ActivityChart({ days }: { days: { date: string; count: number }[] }) {
	const max = Math.max(1, ...days.map((day) => day.count));
	return (
		<>
			<div role="img" aria-label={`Số thao tác mỗi ngày trong 30 ngày qua, nhiều nhất ${max} thao tác một ngày`} style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120, borderBottom: "1px solid var(--tq-line)" }}>
				{days.map((day) => (
					<div key={day.date} title={`${dayText(day.date)}: ${day.count} thao tác`} style={{ flex: 1, minWidth: 0, height: `${Math.max(day.count ? 4 : 1, (day.count / max) * 100)}%`, background: day.count ? "var(--tq-accent)" : "var(--tq-line)", borderRadius: "2px 2px 0 0" }} />
				))}
			</div>
			<div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }} className="tq-muted" aria-hidden="true">
				<span>{dayText(days[0].date).slice(0, 5)}</span>
				<span>{dayText(days[days.length - 1].date).slice(0, 5)}</span>
			</div>
		</>
	);
}

export function DashboardView() {
	const { me, can } = useAdmin();
	const load = useLoader(() => api<Data>("GET", "dashboard"), "dashboard");
	const data = load.data;
	return (
		<>
			<PageHeader title={`Xin chào, ${me.user.name || me.user.email}`} />
			<p className="tq-muted">
				Vai trò của bạn: <strong>{me.user.role}</strong>.
			</p>

			{load.error ? (
				<LoadError error={load.error} onRetry={load.reload} />
			) : !data ? (
				<Loading />
			) : (
				<div className="tq-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}>
					{data.posts ? (
						<section className="tq-panel" aria-labelledby="dash-posts">
							<h2 className="tq-h2" id="dash-posts">Bài viết ({data.posts.total})</h2>
							<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
								{Object.entries(STATUS_LABEL).map(([status, label]) => (
									<li key={status} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--tq-line-soft)" }}>
										<span>{label}</span>
										<strong>{data.posts?.byStatus[status] ?? 0}</strong>
									</li>
								))}
							</ul>
							{can("posts", "view") ? <p style={{ marginTop: 12 }}><Link href="/quan-tri/bai-viet">Mở danh sách bài viết</Link></p> : null}
						</section>
					) : null}

					{data.posts ? (
						<section className="tq-panel" aria-labelledby="dash-pending">
							<h2 className="tq-h2" id="dash-pending">Bài chờ duyệt <Badge tone={data.posts.pending.length ? "warn" : "neutral"}>{data.posts.byStatus.pending ?? 0}</Badge></h2>
							{data.posts.pending.length === 0 ? (
								<EmptyState>Không có bài nào đang chờ duyệt.</EmptyState>
							) : (
								<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
									{data.posts.pending.map((post) => (
										<li key={post.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--tq-line-soft)" }}>
											<Link href={post.link}><strong>{post.title || "(Chưa có tiêu đề)"}</strong></Link>
											<br />
											<span className="tq-muted">{post.author || "Chưa ghi tác giả"} · {dayText(post.date)}</span>
										</li>
									))}
								</ul>
							)}
						</section>
					) : null}

					{data.events ? (
						<section className="tq-panel" aria-labelledby="dash-events">
							<h2 className="tq-h2" id="dash-events">Khóa tu và sự kiện sắp tới</h2>
							{data.events.length === 0 ? (
								<EmptyState>Chưa có sự kiện nào sắp tới.</EmptyState>
							) : (
								<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
									{data.events.map((event) => (
										<li key={event.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--tq-line-soft)" }}>
											<strong>{event.title}</strong>
											<br />
											<span className="tq-muted">
												{event.startDate === event.endDate ? dayText(event.startDate) : `${dayText(event.startDate)} – ${dayText(event.endDate)}`}
												{event.location ? ` · ${event.location}` : ""}
											</span>
										</li>
									))}
								</ul>
							)}
							{can("events", "view") ? <p style={{ marginTop: 12 }}><Link href="/quan-tri/lich-tu-hoc">Mở lịch tu học</Link></p> : null}
						</section>
					) : null}

					{data.activity ? (
						<section className="tq-panel" aria-labelledby="dash-activity" style={{ gridColumn: "1 / -1" }}>
							<h2 className="tq-h2" id="dash-activity">Hoạt động 30 ngày qua ({data.activity.total} thao tác)</h2>
							<ActivityChart days={data.activity.days} />
							<p style={{ marginTop: 12 }}><Link href="/quan-tri/nhat-ky">Xem nhật ký hoạt động</Link></p>
						</section>
					) : null}

					{data.media ? (
						<section className="tq-panel" aria-labelledby="dash-media">
							<h2 className="tq-h2" id="dash-media">Thư viện ảnh</h2>
							<dl className="tq-kv">
								<dt>Tổng số ảnh</dt>
								<dd>{data.media.total.count} ({formatBytes(data.media.total.bytes)})</dd>
								<dt>Tải lên từ trang quản trị</dt>
								<dd>{data.media.library.count} ({formatBytes(data.media.library.bytes)})</dd>
								<dt>Chưa dùng ở đâu</dt>
								<dd>{data.media.unused.count} ({formatBytes(data.media.unused.bytes)})</dd>
							</dl>
							<p><Link href="/quan-tri/media">Mở thư viện</Link></p>
						</section>
					) : null}

					{data.users ? (
						<section className="tq-panel" aria-labelledby="dash-users">
							<h2 className="tq-h2" id="dash-users">Tài khoản</h2>
							<dl className="tq-kv">
								<dt>Đang có</dt>
								<dd>{data.users.total}</dd>
								<dt>Đang bị khóa</dt>
								<dd>{data.users.locked}</dd>
							</dl>
							<p><Link href="/quan-tri/tai-khoan">Mở danh sách tài khoản</Link></p>
						</section>
					) : null}

					<section className="tq-panel" aria-labelledby="dash-me">
						<h2 className="tq-h2" id="dash-me">Hồ sơ và bảo mật</h2>
						<p className="tq-muted">Đổi mật khẩu, bật xác thực hai bước, xem thiết bị đang đăng nhập.</p>
						<Link href="/quan-tri/ho-so">Mở hồ sơ</Link>
					</section>
				</div>
			)}
		</>
	);
}
