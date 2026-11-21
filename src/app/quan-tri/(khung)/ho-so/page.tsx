"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { Alert, Badge, Button, EmptyState, errorText, fieldErrors, Loading, PageHeader, TextField, when } from "@/components/admin/ui";

type Session = { id: string; createdAt: string; lastUsedAt: string; ip: string; userAgent: string; current: boolean };

function NameForm() {
	const { me, reload } = useAdmin();
	const [name, setName] = useState(me.user.name);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);
	const [fields, setFields] = useState<Record<string, string>>({});

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setSaved(false);
		setFields({});
		try {
			await api("PATCH", "me", { name });
			await reload();
			setSaved(true);
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		}
		setBusy(false);
	}

	return (
		<form onSubmit={submit} noValidate>
			{error ? <Alert kind="error">{error}</Alert> : null}
			{saved ? <Alert kind="success">Đã lưu.</Alert> : null}
			<dl className="tq-kv" style={{ marginBottom: 14 }}>
				<dt>Email</dt>
				<dd>{me.user.email}</dd>
				<dt>Vai trò</dt>
				<dd>{me.user.role}</dd>
			</dl>
			<TextField label="Họ tên" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} required />
			<Button type="submit" busy={busy}>Lưu</Button>
		</form>
	);
}

function TwoFactor() {
	const { me, reload } = useAdmin();
	const [stage, setStage] = useState<"idle" | "setup" | "codes" | "off">("idle");
	const [secret, setSecret] = useState("");
	const [qr, setQr] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [recovery, setRecovery] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});

	async function run(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		setFields({});
		try {
			await task();
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		}
		setBusy(false);
	}

	const start = () =>
		run(async () => {
			const result = await api<{ secret: string; uri: string }>("POST", "me/2fa/setup", {});
			setSecret(result.secret);
			setQr(await QRCode.toDataURL(result.uri, { margin: 1, width: 220 }));
			setCode("");
			setStage("setup");
		});

	const confirm = (event: FormEvent) => {
		event.preventDefault();
		return run(async () => {
			const result = await api<{ recoveryCodes: string[] }>("POST", "me/2fa/enable", { code });
			setRecovery(result.recoveryCodes);
			setSecret("");
			setQr("");
			setStage("codes");
			await reload();
		});
	};

	const turnOff = (event: FormEvent) => {
		event.preventDefault();
		return run(async () => {
			await api("POST", "me/2fa/disable", { password });
			setPassword("");
			setStage("idle");
			await reload();
		});
	};

	return (
		<div>
			<p>
				Trạng thái: {me.mfaEnabled ? <Badge tone="ok">Đang bật</Badge> : <Badge>Chưa bật</Badge>}
			</p>
			{error ? <Alert kind="error">{error}</Alert> : null}

			{stage === "codes" ? (
				<>
					<Alert kind="success">Đã bật xác thực hai bước.</Alert>
					<p><strong>Mã khôi phục</strong> — mỗi mã dùng được một lần, khi bạn mất điện thoại. Hãy lưu ở nơi an toàn; mã này sẽ không hiện lại.</p>
					<ul className="tq-codes">
						{recovery.map((item) => (
							<li key={item}><span className="tq-code">{item}</span></li>
						))}
					</ul>
					<Button variant="secondary" onClick={() => { setRecovery([]); setStage("idle"); }}>Tôi đã lưu các mã này</Button>
				</>
			) : null}

			{stage === "setup" ? (
				<form onSubmit={confirm} noValidate>
					<ol>
						<li>Cài một ứng dụng xác thực (Google Authenticator, Microsoft Authenticator, Authy…).</li>
						<li>Quét mã QR dưới đây, hoặc nhập khóa thủ công.</li>
						<li>Nhập mã 6 số mà ứng dụng hiện ra để xác nhận.</li>
					</ol>
					{qr ? <img src={qr} alt="Mã QR để thêm tài khoản vào ứng dụng xác thực" width={220} height={220} /> : null}
					<p className="tq-muted">Khóa thủ công: <span className="tq-code">{secret}</span></p>
					<TextField label="Mã 6 số" name="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} error={fields.code} required />
					<div className="tq-actions">
						<Button type="submit" busy={busy}>Xác nhận và bật</Button>
						<Button variant="secondary" onClick={() => setStage("idle")}>Hủy</Button>
					</div>
				</form>
			) : null}

			{stage === "off" ? (
				<form onSubmit={turnOff} noValidate>
					<Alert kind="warning">Tắt xác thực hai bước làm tài khoản kém an toàn hơn. Nhập mật khẩu để xác nhận.</Alert>
					<TextField label="Mật khẩu" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} required />
					<div className="tq-actions">
						<Button type="submit" variant="danger" busy={busy}>Tắt xác thực hai bước</Button>
						<Button variant="secondary" onClick={() => setStage("idle")}>Hủy</Button>
					</div>
				</form>
			) : null}

			{stage === "idle" ? (
				me.mfaEnabled ? (
					<Button variant="secondary" onClick={() => setStage("off")}>Tắt xác thực hai bước</Button>
				) : (
					<Button busy={busy} onClick={() => void start()}>Bật xác thực hai bước</Button>
				)
			) : null}
		</div>
	);
}

function Sessions() {
	const [sessions, setSessions] = useState<Session[] | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState("");

	const load = useCallback(async () => {
		try {
			setSessions((await api<{ sessions: Session[] }>("GET", "me/sessions")).sessions);
			setError("");
		} catch (caught) {
			setError(errorText(caught));
		}
	}, []);

	useEffect(() => {
		// the list is read when the section appears; the state is set when the request answers
		// eslint-disable-next-line react-hooks/set-state-in-effect
		void load();
	}, [load]);

	async function act(task: () => Promise<unknown>, done: string) {
		setBusy(true);
		setNote("");
		try {
			await task();
			setNote(done);
			await load();
		} catch (caught) {
			setError(errorText(caught));
		}
		setBusy(false);
	}

	if (error && !sessions) return <Alert kind="error">{error} <Button variant="link" onClick={() => void load()}>Thử lại</Button></Alert>;
	if (!sessions) return <Loading />;
	return (
		<div>
			{error ? <Alert kind="error">{error}</Alert> : null}
			{note ? <Alert kind="success">{note}</Alert> : null}
			{sessions.length === 0 ? (
				<EmptyState>Không có phiên nào.</EmptyState>
			) : (
				<div className="tq-table-wrap">
					<table className="tq-table">
						<caption className="visually-hidden">Các thiết bị đang đăng nhập</caption>
						<thead>
							<tr><th scope="col">Thiết bị</th><th scope="col">Địa chỉ IP</th><th scope="col">Đăng nhập</th><th scope="col">Dùng gần nhất</th><th scope="col"><span className="visually-hidden">Thao tác</span></th></tr>
						</thead>
						<tbody>
							{sessions.map((item) => (
								<tr key={item.id}>
									<td>{item.userAgent ? item.userAgent.slice(0, 70) : "Không rõ"} {item.current ? <Badge tone="ok">Phiên này</Badge> : null}</td>
									<td>{item.ip || "—"}</td>
									<td>{when(item.createdAt)}</td>
									<td>{when(item.lastUsedAt)}</td>
									<td>{item.current ? null : <Button variant="secondary" className="tq-btn tq-btn--secondary tq-btn--small" disabled={busy} onClick={() => void act(() => api("DELETE", `me/sessions/${item.id}`), "Đã đăng xuất thiết bị đó.")}>Đăng xuất</Button>}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{sessions.some((item) => !item.current) ? (
				<p style={{ marginTop: 14 }}>
					<Button variant="secondary" busy={busy} onClick={() => void act(() => api("DELETE", "me/sessions"), "Đã đăng xuất mọi thiết bị khác.")}>Đăng xuất mọi thiết bị khác</Button>
				</p>
			) : null}
		</div>
	);
}

export default function ProfilePage() {
	return (
		<>
			<PageHeader title="Hồ sơ và bảo mật" />
			<section className="tq-panel" aria-labelledby="h-thongtin">
				<h2 className="tq-h2" id="h-thongtin">Thông tin</h2>
				<NameForm />
			</section>
			<section className="tq-panel" aria-labelledby="h-matkhau">
				<h2 className="tq-h2" id="h-matkhau">Đổi mật khẩu</h2>
				<ChangePasswordForm />
			</section>
			<section className="tq-panel" aria-labelledby="h-2fa">
				<h2 className="tq-h2" id="h-2fa">Xác thực hai bước</h2>
				<TwoFactor />
			</section>
			<section className="tq-panel" aria-labelledby="h-phien">
				<h2 className="tq-h2" id="h-phien">Thiết bị đang đăng nhập</h2>
				<Sessions />
			</section>
		</>
	);
}
