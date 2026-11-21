"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, setCsrf } from "@/components/admin/api";
import { AuthCard } from "@/components/admin/AuthCard";
import { Alert, Button, errorText, fieldErrors, TextField } from "@/components/admin/ui";

type Issued = { status: "ok" | "mfa_required"; mustChangePassword: boolean; csrfToken: string };

/** Only a path inside the admin is followed after sign-in. */
const safeNext = (value: string | null) => (value && value.startsWith("/quan-tri") && !value.startsWith("//") && !value.includes("\\") && !value.startsWith("/quan-tri/dang-nhap") ? value : "/quan-tri");

export default function LoginForm() {
	const router = useRouter();
	const next = safeNext(useSearchParams().get("tiep"));
	const [step, setStep] = useState<"password" | "code">("password");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setFields({});
		try {
			const issued = step === "password" ? await api<Issued>("POST", "auth/login", { email, password }) : await api<Issued>("POST", "auth/2fa/verify", { code });
			setCsrf(issued.csrfToken);
			if (issued.status === "mfa_required") {
				setStep("code");
				setBusy(false);
				return;
			}
			router.replace(next);
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
			setBusy(false);
			if (step === "code" && /hết hạn|đăng nhập lại/i.test(errorText(caught))) setStep("password");
		}
	}

	return (
		<AuthCard title={step === "password" ? "Đăng nhập" : "Xác thực hai bước"}>
			<form onSubmit={submit} noValidate>
				{error ? <Alert kind="error">{error}</Alert> : null}
				{step === "password" ? (
					<>
						<TextField label="Email" type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} required autoFocus />
						<TextField label="Mật khẩu" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} required />
					</>
				) : (
					<>
						<p className="tq-muted">Nhập mã 6 số trong ứng dụng xác thực, hoặc một mã khôi phục.</p>
						<TextField label="Mã xác thực" name="code" inputMode="text" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} error={fields.code} required autoFocus />
					</>
				)}
				<Button type="submit" busy={busy} style={{ width: "100%" }}>{step === "password" ? "Đăng nhập" : "Xác nhận"}</Button>
			</form>
			{step === "password" ? (
				<p style={{ marginTop: 16, marginBottom: 0 }}>
					<Link href="/quan-tri/quen-mat-khau">Quên mật khẩu?</Link>
				</p>
			) : null}
		</AuthCard>
	);
}
