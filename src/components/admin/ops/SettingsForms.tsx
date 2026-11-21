"use client";

import { useState } from "react";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader } from "../media/imageTools";
import { Alert, Badge, Button, errorText, fieldErrors, Loading, PageHeader, SelectField, TextArea, TextField } from "../ui";
import { LoadError, NoRight } from "./common";

const SUPER_ADMIN = "role-super-admin";
type Notice = { kind: "success" | "error"; text: string } | null;

// ------------------------------------------------------------------ temple details

type SiteInfo = {
	name: string;
	slogan: string;
	address: string;
	phones: { role: string; name: string; phone: string }[];
	openingHours: string;
	mapsUrl: string;
	social: { label: string; url: string }[];
	announcement: { id?: string; text: string; link: { label: string; href: string } | null; expires: string; active: boolean };
};

function SiteInfoEditor({ initial, canEdit }: { initial: SiteInfo; canEdit: boolean }) {
	const [form, setForm] = useState<SiteInfo>({ ...initial, announcement: { ...initial.announcement, link: initial.announcement.link ?? { label: "", href: "" } } });
	const [busy, setBusy] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState<Notice>(null);
	const patch = (change: Partial<SiteInfo>) => setForm((old) => ({ ...old, ...change }));
	const note = (change: Partial<SiteInfo["announcement"]>) => setForm((old) => ({ ...old, announcement: { ...old.announcement, ...change } }));
	const error = (key: string) => errors[key];

	async function save(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setErrors({});
		setNotice(null);
		try {
			const announcement = { ...form.announcement };
			delete announcement.id;
			await api("PUT", "settings/site-info", { ...form, announcement: { ...announcement, link: announcement.link?.href ? announcement.link : null } });
			setNotice({ kind: "success", text: "Đã lưu thông tin chùa." });
		} catch (caught) {
			setErrors(fieldErrors(caught));
			setNotice({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(false);
		}
	}

	return (
		<form className="tq-panel" onSubmit={(e) => void save(e)} noValidate aria-label="Thông tin chùa">
			<h2 className="tq-h2">Thông tin chùa</h2>
			<fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
				<TextField label="Tên chùa" value={form.name} error={error("name")} onChange={(e) => patch({ name: e.target.value })} />
				<TextField label="Khẩu hiệu" value={form.slogan} error={error("slogan")} onChange={(e) => patch({ slogan: e.target.value })} />
				<TextField label="Địa chỉ" value={form.address} error={error("address")} onChange={(e) => patch({ address: e.target.value })} />
				<TextField label="Giờ mở cửa" value={form.openingHours} error={error("openingHours")} onChange={(e) => patch({ openingHours: e.target.value })} />
				<TextField label="Liên kết bản đồ" type="url" value={form.mapsUrl} error={error("mapsUrl")} hint="Bắt đầu bằng https://" onChange={(e) => patch({ mapsUrl: e.target.value })} />

				<h3 className="tq-h2" style={{ fontSize: "1rem" }}>Số điện thoại liên hệ</h3>
				{form.phones.length === 0 ? <p className="tq-muted">Chưa có số nào.</p> : null}
				{form.phones.map((phone, index) => (
					<div key={index} className="tq-toolbar" role="group" aria-label={`Số liên hệ ${index + 1}`}>
						<TextField label="Chức vụ" value={phone.role} error={error(`phones.${index}.role`)} onChange={(e) => patch({ phones: form.phones.map((p, i) => (i === index ? { ...p, role: e.target.value } : p)) })} />
						<TextField label="Họ tên" value={phone.name} error={error(`phones.${index}.name`)} onChange={(e) => patch({ phones: form.phones.map((p, i) => (i === index ? { ...p, name: e.target.value } : p)) })} />
						<TextField label="Số điện thoại" inputMode="tel" value={phone.phone} error={error(`phones.${index}.phone`)} onChange={(e) => patch({ phones: form.phones.map((p, i) => (i === index ? { ...p, phone: e.target.value } : p)) })} />
						<Button variant="secondary" onClick={() => patch({ phones: form.phones.filter((_, i) => i !== index) })} aria-label={`Bỏ số liên hệ ${index + 1}`}>Bỏ</Button>
					</div>
				))}
				<p><Button variant="secondary" onClick={() => patch({ phones: [...form.phones, { role: "", name: "", phone: "" }] })}>Thêm số liên hệ</Button></p>

				<h3 className="tq-h2" style={{ fontSize: "1rem" }}>Mạng xã hội</h3>
				{form.social.length === 0 ? <p className="tq-muted">Chưa có liên kết nào.</p> : null}
				{form.social.map((item, index) => (
					<div key={index} className="tq-toolbar" role="group" aria-label={`Liên kết mạng xã hội ${index + 1}`}>
						<TextField label="Tên" value={item.label} error={error(`social.${index}.label`)} onChange={(e) => patch({ social: form.social.map((s, i) => (i === index ? { ...s, label: e.target.value } : s)) })} />
						<TextField label="Liên kết" type="url" value={item.url} error={error(`social.${index}.url`)} onChange={(e) => patch({ social: form.social.map((s, i) => (i === index ? { ...s, url: e.target.value } : s)) })} />
						<Button variant="secondary" onClick={() => patch({ social: form.social.filter((_, i) => i !== index) })} aria-label={`Bỏ liên kết ${index + 1}`}>Bỏ</Button>
					</div>
				))}
				<p><Button variant="secondary" onClick={() => patch({ social: [...form.social, { label: "", url: "" }] })}>Thêm liên kết</Button></p>

				<h3 className="tq-h2" style={{ fontSize: "1rem" }}>Thanh thông báo đầu trang</h3>
				<label className="tq-check">
					<input type="checkbox" checked={form.announcement.active} onChange={(e) => note({ active: e.target.checked })} />
					<span>Đang bật thanh thông báo</span>
				</label>
				<TextArea label="Nội dung thông báo" value={form.announcement.text} error={error("announcement.text")} maxLength={300} hint="Đổi nội dung thì người đã đóng thông báo cũ sẽ thấy lại." onChange={(e) => note({ text: e.target.value })} />
				<div className="tq-toolbar">
					<TextField label="Chữ của liên kết" value={form.announcement.link?.label ?? ""} error={error("announcement.link.label")} onChange={(e) => note({ link: { label: e.target.value, href: form.announcement.link?.href ?? "" } })} />
					<TextField label="Địa chỉ liên kết" value={form.announcement.link?.href ?? ""} error={error("announcement.link.href")} hint="/lich-tu-hoc hoặc https://…" onChange={(e) => note({ link: { label: form.announcement.link?.label ?? "", href: e.target.value } })} />
					<TextField label="Hết hạn vào ngày" type="date" value={form.announcement.expires} error={error("announcement.expires")} onChange={(e) => note({ expires: e.target.value })} />
				</div>
			</fieldset>
			{notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}
			{canEdit ? <button type="submit" className="tq-btn tq-btn--primary" disabled={busy} aria-busy={busy || undefined}>{busy ? "Đang lưu…" : "Lưu thông tin chùa"}</button> : <Alert kind="info">Bạn chỉ có quyền xem phần này.</Alert>}
		</form>
	);
}

function SiteInfoSection({ canEdit }: { canEdit: boolean }) {
	const load = useLoader(() => api<SiteInfo>("GET", "settings/site-info"), "site-info");
	if (load.error) return <LoadError error={load.error} onRetry={load.reload} />;
	if (!load.data) return <Loading />;
	return <SiteInfoEditor initial={load.data} canEdit={canEdit} />;
}

// ------------------------------------------------------------------ security policy

type Policy = { minPasswordLength: number; sessionDays: number; failedLogins: number; floor: number };

function SecurityEditor({ initial }: { initial: Policy }) {
	const [form, setForm] = useState({ minPasswordLength: String(initial.minPasswordLength), sessionDays: String(initial.sessionDays), failedLogins: String(initial.failedLogins) });
	const [busy, setBusy] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState<Notice>(null);
	async function save(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setErrors({});
		setNotice(null);
		try {
			await api("PUT", "settings/security", { minPasswordLength: Number(form.minPasswordLength), sessionDays: Number(form.sessionDays), failedLogins: Number(form.failedLogins) });
			setNotice({ kind: "success", text: "Đã lưu chính sách bảo mật." });
		} catch (caught) {
			setErrors(fieldErrors(caught));
			setNotice({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(false);
		}
	}
	return (
		<form className="tq-panel" onSubmit={(e) => void save(e)} noValidate aria-label="Chính sách bảo mật">
			<h2 className="tq-h2">Chính sách bảo mật</h2>
			<TextField label="Độ dài mật khẩu tối thiểu" type="number" inputMode="numeric" min={initial.floor} max={64} value={form.minPasswordLength} error={errors.minPasswordLength} hint={`Không thể đặt dưới ${initial.floor} ký tự.`} onChange={(e) => setForm({ ...form, minPasswordLength: e.target.value })} />
			<TextField label="Thời hạn phiên đăng nhập (ngày)" type="number" inputMode="numeric" min={1} max={30} value={form.sessionDays} error={errors.sessionDays} onChange={(e) => setForm({ ...form, sessionDays: e.target.value })} />
			<TextField label="Số lần đăng nhập sai trước khi bị chặn tạm" type="number" inputMode="numeric" min={3} max={20} value={form.failedLogins} error={errors.failedLogins} onChange={(e) => setForm({ ...form, failedLogins: e.target.value })} />
			{notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}
			<button type="submit" className="tq-btn tq-btn--primary" disabled={busy} aria-busy={busy || undefined}>{busy ? "Đang lưu…" : "Lưu chính sách"}</button>
		</form>
	);
}

function SecuritySection() {
	const load = useLoader(() => api<Policy>("GET", "settings/security"), "security");
	if (load.error) return <LoadError error={load.error} onRetry={load.reload} />;
	if (!load.data) return <Loading />;
	return <SecurityEditor initial={load.data} />;
}

// ------------------------------------------------------------------ mail server

type Smtp = { host: string; port: 465 | 587; username: string; passwordSet: boolean; passwordReadable?: boolean; fromName: string; fromEmail: string; configured: boolean };

function SmtpEditor({ initial, onSaved }: { initial: Smtp; onSaved: () => void }) {
	const [form, setForm] = useState({ host: initial.host, port: String(initial.port), username: initial.username, password: "", fromName: initial.fromName, fromEmail: initial.fromEmail });
	const [busy, setBusy] = useState<"save" | "test" | null>(null);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState<Notice>(null);

	async function save(event: React.FormEvent) {
		event.preventDefault();
		setBusy("save");
		setErrors({});
		setNotice(null);
		try {
			await api("PUT", "settings/smtp", { host: form.host, port: Number(form.port), username: form.username, password: form.password || undefined, fromName: form.fromName, fromEmail: form.fromEmail });
			setForm((old) => ({ ...old, password: "" }));
			setNotice({ kind: "success", text: "Đã lưu cấu hình máy chủ thư. Bấm “Gửi thư thử” để kiểm tra." });
			onSaved();
		} catch (caught) {
			setErrors(fieldErrors(caught));
			setNotice({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(null);
		}
	}
	async function test() {
		setBusy("test");
		setNotice(null);
		try {
			const sent = await api<{ to: string }>("POST", "settings/smtp/test", {});
			setNotice({ kind: "success", text: `Đã gửi thư thử tới ${sent.to}. Hãy kiểm tra hộp thư (cả mục thư rác).` });
		} catch (caught) {
			setNotice({ kind: "error", text: `Gửi thư thử không được: ${errorText(caught)}` });
		} finally {
			setBusy(null);
		}
	}

	return (
		<form className="tq-panel" onSubmit={(e) => void save(e)} noValidate aria-label="Máy chủ thư">
			<h2 className="tq-h2">Máy chủ thư (SMTP) {initial.configured ? <Badge tone="ok">Đã cấu hình</Badge> : <Badge tone="warn">Chưa cấu hình</Badge>}</h2>
			<p className="tq-muted">Dùng để gửi thư đặt lại mật khẩu và thông báo. Mật khẩu được mã hóa và không bao giờ hiển thị lại.</p>
			{initial.passwordSet && initial.passwordReadable === false ? <Alert kind="warning">Mật khẩu đã lưu không đọc được nữa (khóa mã hóa đã đổi). Hãy nhập lại mật khẩu.</Alert> : null}
			<TextField label="Máy chủ" value={form.host} error={errors.host} placeholder="smtp.example.com" autoComplete="off" onChange={(e) => setForm({ ...form, host: e.target.value })} />
			<SelectField label="Cổng" value={form.port} error={errors.port} hint="465: mã hóa ngay khi kết nối. 587: nâng cấp lên mã hóa (STARTTLS)." onChange={(e) => setForm({ ...form, port: e.target.value })}>
				<option value="587">587 (STARTTLS)</option>
				<option value="465">465 (TLS)</option>
			</SelectField>
			<TextField label="Tài khoản" value={form.username} error={errors.username} autoComplete="off" onChange={(e) => setForm({ ...form, username: e.target.value })} />
			<TextField
				label="Mật khẩu"
				type="password"
				value={form.password}
				error={errors.password}
				autoComplete="new-password"
				placeholder={initial.passwordSet ? "Đã lưu (để trống nếu giữ nguyên)" : ""}
				hint={initial.passwordSet ? "Để trống để giữ mật khẩu hiện tại. Đổi máy chủ, cổng hoặc tài khoản thì phải nhập lại." : undefined}
				onChange={(e) => setForm({ ...form, password: e.target.value })}
			/>
			<TextField label="Tên người gửi" value={form.fromName} error={errors.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} />
			<TextField label="Email người gửi" type="email" value={form.fromEmail} error={errors.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} />
			{notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}
			<div className="tq-actions">
				<button type="submit" className="tq-btn tq-btn--primary" disabled={busy !== null} aria-busy={busy === "save" || undefined}>{busy === "save" ? "Đang lưu…" : "Lưu cấu hình"}</button>
				<Button variant="secondary" busy={busy === "test"} disabled={busy !== null || !initial.configured} onClick={() => void test()}>Gửi thư thử tới email của tôi</Button>
			</div>
		</form>
	);
}

function SmtpSection() {
	const load = useLoader(() => api<Smtp>("GET", "settings/smtp"), "smtp");
	if (load.error) return <LoadError error={load.error} onRetry={load.reload} />;
	if (!load.data) return <Loading />;
	return <SmtpEditor initial={load.data} onSaved={load.reload} />;
}

export function SettingsPage() {
	const { me, can } = useAdmin();
	if (!can("settings", "view")) return <NoRight />;
	const superAdmin = me.user.roleId === SUPER_ADMIN;
	return (
		<>
			<PageHeader title="Cấu hình hệ thống" />
			<SiteInfoSection canEdit={can("settings", "update")} />
			{superAdmin ? <SecuritySection /> : null}
			{superAdmin ? <SmtpSection /> : <Alert kind="info">Chính sách bảo mật và máy chủ thư chỉ Super Admin xem và sửa được.</Alert>}
		</>
	);
}
