"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/components/admin/api";
import { AuthCard } from "@/components/admin/AuthCard";
import { Alert, Button, errorText, fieldErrors, TextField } from "@/components/admin/ui";

export default function ResetForm() {
	const params = useSearchParams();
	// Keep the token in memory and take it off the address bar at once.
	const [token] = useState(() => params.get("token") ?? "");
	const [password, setPassword] = useState("");
	const [again, setAgain] = useState("");
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState("");
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});

	useEffect(() => {
		if (token) window.history.replaceState(null, "", window.location.pathname);
	}, [token]);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setError("");
		setFields({});
		if (password !== again) {
			setFields({ again: "Hai mật khẩu chưa giống nhau." });
			return;
		}
		setBusy(true);
		try {
			const result = await api<{ message: string }>("POST", "auth/reset-password", { token, password });
			setDone(result.message);
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		}
		setBusy(false);
	}

	if (!token && !done) {
		return (
			<AuthCard title="Đặt lại mật khẩu">
				<Alert kind="error">Liên kết không hợp lệ hoặc đã được dùng. Hãy yêu cầu liên kết mới.</Alert>
				<Link href="/quan-tri/quen-mat-khau">Yêu cầu liên kết mới</Link>
			</AuthCard>
		);
	}

	return (
		<AuthCard title="Đặt lại mật khẩu">
			{done ? (
				<>
					<Alert kind="success">{done}</Alert>
					<Link className="tq-btn" href="/quan-tri/dang-nhap">Đăng nhập</Link>
				</>
			) : (
				<form onSubmit={submit} noValidate>
					{error ? <Alert kind="error">{error}</Alert> : null}
					<TextField label="Mật khẩu mới" type="password" name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} hint="Ít nhất 10 ký tự." required autoFocus />
					<TextField label="Nhập lại mật khẩu mới" type="password" name="again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} error={fields.again} required />
					<Button type="submit" busy={busy} style={{ width: "100%" }}>Đặt mật khẩu mới</Button>
				</form>
			)}
		</AuthCard>
	);
}
