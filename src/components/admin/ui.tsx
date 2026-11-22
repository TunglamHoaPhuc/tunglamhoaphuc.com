"use client";

// The few building blocks the admin pages share. Feedback is always a block in the page flow (no pop-ups,
// no toasts): the brand rule of design-system/tokens.css applies here too.
import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId, useSyncExternalStore } from "react";
import { ApiClientError } from "./api";

export const errorText = (error: unknown) => (error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : "Có lỗi xảy ra. Hãy thử lại.");
export const fieldErrors = (error: unknown): Record<string, string> => (error instanceof ApiClientError && error.fields ? error.fields : {});

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
	return (
		<div className={`tq-alert tq-alert--${kind}`} role={kind === "error" ? "alert" : "status"}>
			{children}
		</div>
	);
}

type FieldProps = { label: string; error?: string; hint?: string; children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode };

export function Field({ label, error, hint, children }: FieldProps) {
	const id = useId();
	const note = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
	return (
		<div className="tq-field">
			<label htmlFor={id} className="tq-label">{label}</label>
			{children({ id, ...(error ? { "aria-invalid": true as const } : {}), "aria-describedby": note })}
			{error ? <p id={`${id}-error`} className="tq-field-error">{error}</p> : hint ? <p id={`${id}-hint`} className="tq-hint">{hint}</p> : null}
		</div>
	);
}

export function TextField({ label, error, hint, ...input }: { label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
	return <Field label={label} error={error} hint={hint}>{(a11y) => <input className="tq-input" {...a11y} {...input} />}</Field>;
}

export function SelectField({ label, error, hint, children, ...select }: { label: string; error?: string; hint?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
	return <Field label={label} error={error} hint={hint}>{(a11y) => <select className="tq-input" {...a11y} {...select}>{children}</select>}</Field>;
}

export function TextArea({ label, error, hint, ...area }: { label: string; error?: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return <Field label={label} error={error} hint={hint}>{(a11y) => <textarea className="tq-input" rows={3} {...a11y} {...area} />}</Field>;
}

/** False while the page is still server-rendered HTML, true once React runs in the browser. */
const useHydrated = () => useSyncExternalStore(() => () => undefined, () => true, () => false);

export function Button({ variant = "primary", busy, children, ...button }: { variant?: "primary" | "secondary" | "danger" | "link"; busy?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
	// A submit button stays off until React has taken the page over: before that, its form would be sent by the
	// browser itself (a GET with the typed fields, passwords included, in the address).
	const waiting = !useHydrated() && button.type === "submit";
	return (
		<button type="button" className={`tq-btn tq-btn--${variant}`} aria-busy={busy || undefined} {...button} disabled={busy || button.disabled || waiting}>
			{busy ? "Đang xử lý…" : children}
		</button>
	);
}

export function PageHeader({ title, children, back }: { title: string; children?: ReactNode; back?: ReactNode }) {
	return (
		<header className="tq-page-header">
			<div>
				{back}
				<h1 className="tq-h1">{title}</h1>
			</div>
			{children ? <div className="tq-actions">{children}</div> : null}
		</header>
	);
}

/** The page a person may not open: the menu's own words, in the page flow (no pop-up), with the way back. */
export function NoAccess({ action = "view" }: { action?: string }) {
	return (
		<>
			<PageHeader title="Không có quyền truy cập" />
			<Alert kind="warning">{action === "create" ? "Bạn không có quyền tạo mục này." : "Bạn không có quyền xem mục này."} Nếu cần, hãy nhờ quản trị viên cấp quyền cho vai trò của bạn.</Alert>
			<p>
				<Link href="/quan-tri">Về trang Tổng quan</Link>
			</p>
		</>
	);
}

export const Loading = ({ label = "Đang tải…" }: { label?: string }) => <p className="tq-muted" role="status">{label}</p>;

export function EmptyState({ children }: { children: ReactNode }) {
	return <div className="tq-empty">{children}</div>;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "danger"; children: ReactNode }) {
	return <span className={`tq-badge tq-badge--${tone}`}>{children}</span>;
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
	const pages = Math.max(1, Math.ceil(total / pageSize));
	if (pages <= 1) return null;
	return (
		<nav className="tq-pager" aria-label="Phân trang">
			<Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Trang trước</Button>
			<span className="tq-muted">Trang {page}/{pages} · {total} mục</span>
			<Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Trang sau</Button>
		</nav>
	);
}

/** Formats an ISO time as dd/mm/yyyy hh:mm in Vietnam time. */
export function when(iso: string | null | undefined): string {
	if (!iso) return "—";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}
