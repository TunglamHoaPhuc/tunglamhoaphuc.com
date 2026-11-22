"use client";

import { useState } from "react";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader } from "../media/imageTools";
import { Alert, Button, EmptyState, errorText, Loading, PageHeader, TextField, when } from "../ui";
import { formatBytes, LoadError, NoRight } from "./common";

type Stored = { name: string; size: number; createdAt: string };
type List = { configured: boolean; backups: Stored[] };

/** Saves a Blob as a file through a temporary link. */
function saveBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function BackupPanel() {
	const { me, can } = useAdmin();
	const list = useLoader(() => api<List>("GET", "backup"), "backup");
	const [password, setPassword] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [busy, setBusy] = useState<"export" | "stored" | "run" | null>(null);
	const [downloading, setDownloading] = useState<string | null>(null);
	const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

	if (!can("backup", "view")) return <NoRight />;

	async function runNow() {
		setBusy("run");
		setNotice(null);
		try {
			const done = await api<Stored & { removed: number }>("POST", "backup/run", {});
			setNotice({ kind: "success", text: `Đã lưu bản sao lưu ${done.name} (${formatBytes(done.size)}) vào kho lưu trữ.${done.removed ? ` Đã xóa ${done.removed} bản cũ.` : ""}` });
			list.reload();
		} catch (caught) {
			setNotice({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(null);
		}
	}

	function exportNow(event: React.FormEvent) {
		event.preventDefault();
		return fetchFile("export", "backup/export");
	}

	/** Asks for a file with the password and saves it. `which` is "export" (made now) or a stored file's name. */
	async function fetchFile(which: string, path: string) {
		setBusy(which === "export" ? "export" : "stored");
		setDownloading(which);
		setNotice(null);
		setPasswordError("");
		try {
			// The file is not JSON, so it does not go through the api helper; the CSRF token is the one /auth/me gave.
			const response = await fetch(`/api/quan-tri/v1/${path}`, {
				method: "POST",
				credentials: "same-origin",
				cache: "no-store",
				headers: { "Content-Type": "application/json", "X-TLHP-CSRF": me.csrfToken },
				body: JSON.stringify({ password }),
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string> } } | null;
				if (body?.error?.fields?.password) setPasswordError(body.error.fields.password);
				throw new Error(body?.error?.message ?? "Không tạo được bản sao lưu. Hãy thử lại.");
			}
			const disposition = response.headers.get("content-disposition") ?? "";
			const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "tlhp-backup.json.gz";
			saveBlob(await response.blob(), name);
			setPassword("");
			setNotice({ kind: "success", text: `Đã tải về ${name}. Tệp chứa toàn bộ nội dung nhưng không có mật khẩu: hãy cất ở nơi an toàn.` });
		} catch (caught) {
			setNotice({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(null);
			setDownloading(null);
		}
	}

	const data = list.data;
	return (
		<>
			<PageHeader title="Sao lưu" />
			<p className="tq-muted">Bản sao lưu là một tệp nén chứa toàn bộ nội dung, cấu hình và nhật ký. Không có mật khẩu đăng nhập, mã 2FA hay mật khẩu thư. Khôi phục là việc của người vận hành, làm bằng script (xem docs/van-hanh/sao-luu.md).</p>

			{notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}

			{can("backup", "create") ? (
				<form className="tq-panel" onSubmit={(e) => void exportNow(e)} noValidate aria-label="Tải bản sao lưu về máy">
					<h2 className="tq-h2">Tải bản sao lưu về máy</h2>
					<TextField label="Nhập lại mật khẩu của bạn" type="password" autoComplete="current-password" value={password} error={passwordError} onChange={(e) => setPassword(e.target.value)} hint="Để chắc chắn đúng là bạn đang tải toàn bộ dữ liệu." />
					<button type="submit" className="tq-btn tq-btn--primary" disabled={busy !== null || !password} aria-busy={busy === "export" || undefined}>
						{busy === "export" ? "Đang tạo bản sao lưu…" : "Tạo và tải về"}
					</button>
				</form>
			) : null}

			<section className="tq-panel" aria-labelledby="backup-stored">
				<h2 className="tq-h2" id="backup-stored">Bản sao lưu trong kho lưu trữ</h2>
				{list.error ? (
					<LoadError error={list.error} onRetry={list.reload} />
				) : !data ? (
					<Loading />
				) : !data.configured ? (
					<Alert kind="warning">Máy chủ này chưa gắn kho lưu trữ sao lưu (R2 tlhp-backup), nên chưa lưu được bản tự động. Vẫn tải về máy được ở trên.</Alert>
				) : (
					<>
						{can("backup", "create") ? (
							<p>
								<Button variant="secondary" busy={busy === "run"} disabled={busy !== null} onClick={() => void runNow()}>Sao lưu vào kho lưu trữ ngay</Button>
							</p>
						) : null}
						<p className="tq-hint">Giữ 30 bản mới nhất; bản cũ hơn tự bị xóa.</p>
						{data.backups.length > 0 ? (
							<TextField label="Nhập lại mật khẩu của bạn để tải một bản" type="password" autoComplete="current-password" value={password} error={passwordError} onChange={(e) => setPassword(e.target.value)} hint="Mỗi lần tải đều hỏi lại mật khẩu, vì tệp chứa toàn bộ nội dung." />
						) : null}
						{data.backups.length === 0 ? (
							<EmptyState>Chưa có bản sao lưu nào trong kho lưu trữ.</EmptyState>
						) : (
							<div className="tq-table-wrap">
								<table className="tq-table">
									<caption className="tq-h2">Danh sách ({data.backups.length})</caption>
									<thead>
										<tr>
											<th scope="col">Tên tệp</th>
											<th scope="col">Lưu lúc</th>
											<th scope="col">Dung lượng</th>
											<th scope="col">Tải về</th>
										</tr>
									</thead>
									<tbody>
										{data.backups.map((backup) => (
											<tr key={backup.name}>
												<td>{backup.name}</td>
												<td>{when(backup.createdAt)}</td>
												<td>{formatBytes(backup.size)}</td>
												<td>
													<Button variant="secondary" busy={downloading === backup.name} disabled={busy !== null || !password} onClick={() => void fetchFile(backup.name, `backup/${encodeURIComponent(backup.name)}/download`)}>
														Tải <span className="tq-muted">({backup.name})</span>
													</Button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</>
				)}
			</section>
		</>
	);
}
