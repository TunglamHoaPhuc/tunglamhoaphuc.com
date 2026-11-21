"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/components/admin/api";
import { AuthCard } from "@/components/admin/AuthCard";
import { Alert, Button, errorText, fieldErrors, TextField } from "@/components/admin/ui";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [busy, setBusy] = useState(false);
	const [sent, setSent] = useState("");
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setFields({});
		try {
			const result = await api<{ message: string }>("POST", "auth/forgot-password", { email });
			setSent(result.message);
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		}
		setBusy(false);
	}

	return (
		<AuthCard title="Quên mật khẩu">
			{sent ? (
				<>
					<Alert kind="success">{sent}</Alert>
					<p className="tq-muted">Liên kết có hiệu lực 20 phút và chỉ dùng được một lần.</p>
				</>
			) : (
				<form onSubmit={submit} noValidate>
					<p className="tq-muted">Nhập email đăng nhập. Chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.</p>
					{error ? <Alert kind="error">{error}</Alert> : null}
					<TextField label="Email" type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} required autoFocus />
					<Button type="submit" busy={busy} style={{ width: "100%" }}>Gửi liên kết</Button>
				</form>
			)}
			<p style={{ marginTop: 16, marginBottom: 0 }}>
				<Link href="/quan-tri/dang-nhap">Quay lại đăng nhập</Link>
			</p>
		</AuthCard>
	);
}
