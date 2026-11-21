"use client";

// Small pieces the special-content screens share: a picture field that opens the media library inline, up/down
// buttons, a status picker, the vertical-crop picker and the "save" feedback block.
import { useState, type ReactNode } from "react";
import { MediaPicker } from "../media/MediaPicker";
import type { MediaItem } from "../media/imageTools";
import { Alert, Button, Field } from "../ui";

export const dateVn = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

/** A copy of a list with the item at `from` moved to `to` (Lên / Xuống). */
export function moved<T>(items: T[], from: number, to: number): T[] {
	if (to < 0 || to >= items.length || from === to) return items;
	const next = [...items];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
}

export function MoveButtons({ index, length, onMove, label }: { index: number; length: number; onMove: (to: number) => void; label: string }) {
	return (
		<span className="tq-actions" style={{ flexWrap: "nowrap" }}>
			<Button variant="secondary" className="tq-btn tq-btn--secondary tq-btn--small" disabled={index <= 0} onClick={() => onMove(index - 1)} aria-label={`Đưa ${label} lên`}>
				Lên
			</Button>
			<Button variant="secondary" className="tq-btn tq-btn--secondary tq-btn--small" disabled={index >= length - 1} onClick={() => onMove(index + 1)} aria-label={`Đưa ${label} xuống`}>
				Xuống
			</Button>
		</span>
	);
}

const POSITIONS = [
	["center 0%", "Sát trên"],
	["center 25%", "Hơi cao"],
	["center 50%", "Giữa"],
	["center 75%", "Hơi thấp"],
	["center 100%", "Sát dưới"],
];

export function PositionSelect({ value, onChange, label = "Vùng ảnh được giữ khi cắt khung" }: { value: string; onChange: (value: string) => void; label?: string }) {
	const known = POSITIONS.some(([key]) => key === value);
	return (
		<Field label={label}>
			{(a11y) => (
				<select className="tq-input" {...a11y} value={value} onChange={(event) => onChange(event.target.value)}>
					{known ? null : <option value={value}>{value}</option>}
					{POSITIONS.map(([key, name]) => (
						<option key={key} value={key}>
							{name}
						</option>
					))}
				</select>
			)}
		</Field>
	);
}

export type Picture = { id: string; url: string };

/** A picture of the library: a thumbnail with "Chọn ảnh" (opens the library right here) and "Gỡ ảnh". */
export function PictureField({ label, value, onChange, disabled, error }: { label: string; value: Picture | null; onChange: (value: Picture | null) => void; disabled?: boolean; error?: string }) {
	const [open, setOpen] = useState(false);
	function pick(item: MediaItem) {
		onChange({ id: item.id, url: item.url });
		setOpen(false);
	}
	return (
		<div className="tq-field">
			<span className="tq-label" id={`pf-${label}`}>
				{label}
			</span>
			<div role="group" aria-labelledby={`pf-${label}`} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
				{value?.url ? <img src={value.url} alt="" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid var(--tq-line)" }} /> : <span className="tq-muted">Chưa chọn ảnh.</span>}
				{disabled ? null : (
					<span className="tq-actions">
						<Button variant="secondary" onClick={() => setOpen((current) => !current)}>
							{value ? "Đổi ảnh" : "Chọn ảnh"}
						</Button>
						{value ? (
							<Button variant="secondary" onClick={() => onChange(null)}>
								Gỡ ảnh
							</Button>
						) : null}
					</span>
				)}
			</div>
			{error ? <p className="tq-field-error">{error}</p> : null}
			{open ? <MediaPicker onPick={pick} onCancel={() => setOpen(false)} /> : null}
		</div>
	);
}

export const STATUS_OPTIONS: [string, string][] = [
	["draft", "Bản nháp"],
	["published", "Đã xuất bản"],
	["hidden", "Tạm ẩn"],
];

export function StatusSelect({ value, onChange, canPublish, error }: { value: string; onChange: (value: string) => void; canPublish: boolean; error?: string }) {
	return (
		<Field label="Trạng thái" error={error} hint={canPublish ? undefined : "Bạn chỉ lưu được bản nháp. Nhờ người có quyền xuất bản để đăng."}>
			{(a11y) => (
				<select className="tq-input" {...a11y} value={value} onChange={(event) => onChange(event.target.value)}>
					{STATUS_OPTIONS.map(([key, name]) => (
						<option key={key} value={key} disabled={!canPublish && key !== "draft" && key !== value}>
							{name}
						</option>
					))}
				</select>
			)}
		</Field>
	);
}

/** The result block of a save: a success line or an error, in the page flow. */
export function Feedback({ notice, error, children }: { notice?: string; error?: string; children?: ReactNode }) {
	return (
		<>
			{error ? <Alert kind="error">{error}</Alert> : null}
			{notice ? <Alert kind="success">{notice}</Alert> : null}
			{children}
		</>
	);
}

/** A "delete" button that asks again inline before it acts. */
export function ConfirmDelete({ what, busy, onConfirm }: { what: string; busy?: boolean; onConfirm: () => void }) {
	const [asking, setAsking] = useState(false);
	if (!asking) {
		return (
			<Button variant="danger" onClick={() => setAsking(true)}>
				Xóa {what}
			</Button>
		);
	}
	return (
		<div className="tq-alert tq-alert--warning" role="alert">
			<p style={{ margin: "0 0 8px" }}>Chuyển {what} vào thùng rác? Có thể khôi phục từ thùng rác sau.</p>
			<span className="tq-actions">
				<Button variant="danger" busy={busy} onClick={onConfirm}>
					Chuyển vào thùng rác
				</Button>
				<Button variant="secondary" onClick={() => setAsking(false)}>
					Không xóa
				</Button>
			</span>
		</div>
	);
}
