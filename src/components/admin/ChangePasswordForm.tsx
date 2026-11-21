"use client";

import { useState, type FormEvent } from "react";
import { api } from "./api";
import { Alert, Button, errorText, fieldErrors, TextField } from "./ui";

/** Current password + a new one twice. `onDone` runs after the change (the other sessions have ended by then). */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [again, setAgain] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);
	const [fields, setFields] = useState<Record<string, string>>({});

	async function submit(event: FormEvent) {
		event.preventDefault();
		setError("");
		setFields({});
		setDone(false);
		if (next !== again) {
			setFields({ again: "Hai mật khẩu mới chưa giống nhau." });
			return;
		}
		setBusy(true);
		try {
			await api("POST", "me/password", { current, next });
			setCurrent("");
			setNext("");
			setAgain("");
			setDone(true);
			onDone?.();
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		}
		setBusy(false);
	}

	return (
		<form onSubmit={submit} noValidate>
			{error ? <Alert kind="error">{error}</Alert> : null}
			{done ? <Alert kind="success">Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.</Alert> : null}
			<TextField label="Mật khẩu hiện tại" type="password" name="current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={fields.current} required />
			<TextField label="Mật khẩu mới" type="password" name="next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={fields.next} hint="Ít nhất 10 ký tự, không quá phổ biến." required />
			<TextField label="Nhập lại mật khẩu mới" type="password" name="again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} error={fields.again} required />
			<Button type="submit" busy={busy}>Đổi mật khẩu</Button>
		</form>
	);
}
