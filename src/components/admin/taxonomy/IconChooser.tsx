"use client";

import { useEffect, useId, useState } from "react";
import { api } from "../api";
import { MediaPicker } from "../media/MediaPicker";
import { useDebounced, type MediaItem } from "../media/imageTools";
import { Alert, Button, errorText, TextField } from "../ui";
import { NO_ICON, type IconHit, type IconType, type IconValue } from "./types";

/** The server's own answer (library icon or cleaned SVG) is the only markup drawn inline; the textarea's raw text never is. */
const draw = (svg: string) => (svg.startsWith("<svg") ? <span aria-hidden="true" style={{ display: "inline-flex", width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: svg.replace(/^<svg\b([^>]*)>/, (_all, attrs: string) => `<svg${attrs.replace(/\s(?:width|height)="[^"]*"/g, "")} width="100%" height="100%">`) }} /> : null);

/** What the icon looks like, on a light and on the dark chip the public header uses. */
export function IconPreview({ icon, svg, label }: { icon: IconValue; svg?: string; label: string }) {
	const color = icon.iconColor || "#835414";
	const inner = icon.iconType === "image" && icon.iconUrl ? (
		<img src={icon.iconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
	) : (icon.iconType === "library" || icon.iconType === "svg") && svg ? (
		<span style={{ display: "inline-flex", width: "100%", height: "100%", color }}>{draw(svg)}</span>
	) : icon.iconType === "none" ? (
		<span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f2c14e", display: "inline-block" }} />
	) : null;
	const chip = (background: string, name: string) => (
		<span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
			<span style={{ width: 40, height: 40, borderRadius: "50%", background, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--tq-line)" }}>
				<span style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", color: icon.iconColor || (name === "tối" ? "#f2c14e" : color) }}>{inner}</span>
			</span>
			<span className="tq-muted" style={{ fontSize: 13 }}>Nền {name}</span>
		</span>
	);
	return (
		<div role="img" aria-label={`Xem trước icon của ${label}`} style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
			{chip("#ffffff", "sáng")}
			{chip("#1c140d", "tối")}
		</div>
	);
}

const TYPES: { value: IconType; label: string }[] = [
	{ value: "none", label: "Không có icon" },
	{ value: "library", label: "Chọn từ thư viện" },
	{ value: "svg", label: "Tải lên SVG" },
	{ value: "image", label: "Dùng ảnh" },
];

/**
 * Chooses an icon: none, a library icon found by searching (names and Vietnamese words), an SVG pasted or uploaded
 * (cleaned by the server before it is shown), or a picture (library picture or an upload through the media library).
 */
export function IconChooser({ value, onChange, label, error }: { value: IconValue; onChange: (value: IconValue) => void; label: string; error?: string }) {
	const name = useId();
	const [q, setQ] = useState("");
	const search = useDebounced(q.trim(), 250);
	const [hits, setHits] = useState<IconHit[] | null>(null);
	const [searchError, setSearchError] = useState("");
	const [draft, setDraft] = useState(value.iconSvg);
	const [svgState, setSvgState] = useState<{ cleaned: string; error: string; busy: boolean }>({ cleaned: value.iconType === "svg" ? value.iconSvg : "", error: "", busy: false });
	const [picking, setPicking] = useState(false);

	useEffect(() => {
		if (value.iconType !== "library") return;
		let alive = true;
		api<IconHit[]>("GET", `icons?q=${encodeURIComponent(search)}&limit=80`)
			.then((rows) => {
				if (!alive) return;
				setHits(rows);
				setSearchError("");
			})
			.catch((caught) => alive && setSearchError(errorText(caught)));
		return () => {
			alive = false;
		};
	}, [value.iconType, search]);

	// The picture of an icon chosen earlier (not among the search results): ask the server for it by name.
	const known = hits?.find((hit) => hit.name === value.iconName)?.svg;
	const [fetched, setFetched] = useState({ name: "", svg: "" });
	useEffect(() => {
		if (value.iconType !== "library" || !value.iconName || known) return;
		let alive = true;
		api<IconHit[]>("GET", `icons?q=${encodeURIComponent(value.iconName)}&limit=200`)
			.then((rows) => alive && setFetched({ name: value.iconName, svg: rows.find((hit) => hit.name === value.iconName)?.svg ?? "" }))
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, [value.iconType, value.iconName, known]);
	const selectedSvg = known ?? (fetched.name === value.iconName ? fetched.svg : "");

	const setType = (iconType: IconType) => onChange({ ...NO_ICON, iconType, iconColor: iconType === "none" ? "" : value.iconColor });

	async function clean(text: string) {
		setDraft(text);
		if (!text.trim()) {
			setSvgState({ cleaned: "", error: "", busy: false });
			onChange({ ...value, iconSvg: "" });
			return;
		}
		setSvgState((old) => ({ ...old, busy: true, error: "" }));
		try {
			const result = await api<{ svg: string }>("POST", "icons/sanitize-svg", { svg: text });
			setSvgState({ cleaned: result.svg, error: "", busy: false });
			onChange({ ...value, iconType: "svg", iconSvg: result.svg });
		} catch (caught) {
			setSvgState({ cleaned: "", error: errorText(caught), busy: false });
			onChange({ ...value, iconType: "svg", iconSvg: "" });
		}
	}

	async function readFile(file: File | undefined) {
		if (!file) return;
		if (file.size > 60 * 1024) {
			setSvgState({ cleaned: "", error: "Tệp SVG lớn hơn 50 KB. Hãy dùng biểu tượng đơn giản hơn.", busy: false });
			return;
		}
		await clean(await file.text());
	}

	const previewSvg = value.iconType === "library" ? selectedSvg : value.iconType === "svg" ? svgState.cleaned : "";
	const showColor = value.iconType === "library" || value.iconType === "svg";

	return (
		<fieldset className="tq-panel" style={{ margin: 0 }}>
			<legend className="tq-label" style={{ padding: "0 6px" }}>Icon</legend>
			<div role="radiogroup" aria-label="Kiểu icon" style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginBottom: 12 }}>
				{TYPES.map((type) => (
					<label key={type.value} className="tq-check" style={{ margin: 0 }}>
						<input type="radio" name={`${name}-type`} checked={value.iconType === type.value} onChange={() => setType(type.value)} />
						<span>{type.label}</span>
					</label>
				))}
			</div>
			{error ? <Alert kind="error">{error}</Alert> : null}

			{value.iconType === "library" ? (
				<div>
					<TextField label="Tìm icon (tên hoặc tiếng Việt, ví dụ: chùa, lịch, sách)" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
					{searchError ? <Alert kind="error">{searchError}</Alert> : null}
					{hits === null && !searchError ? <p className="tq-muted" role="status">Đang tải…</p> : null}
					{hits && hits.length === 0 ? <p className="tq-muted">Không có icon nào khớp. Thử một từ khác.</p> : null}
					<ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 8, maxHeight: 280, overflowY: "auto" }}>
						{(hits ?? []).map((hit) => {
							const active = value.iconName === hit.name;
							return (
								<li key={hit.name}>
									<button
										type="button"
										onClick={() => onChange({ ...value, iconType: "library", iconName: hit.name })}
										aria-pressed={active}
										title={hit.keywords}
										style={{ width: "100%", padding: 6, font: "inherit", fontSize: 11, color: "inherit", cursor: "pointer", background: active ? "var(--tq-accent-soft)" : "var(--tq-card)", border: `2px solid ${active ? "var(--tq-accent)" : "var(--tq-line)"}`, borderRadius: 8, textAlign: "center" }}
									>
										<span style={{ display: "block", width: 28, height: 28, margin: "0 auto 4px", color: "var(--tq-ink)" }}>{draw(hit.svg)}</span>
										<span style={{ display: "block", overflowWrap: "anywhere" }}>{hit.name}</span>
									</button>
								</li>
							);
						})}
					</ul>
				</div>
			) : null}

			{value.iconType === "svg" ? (
				<div>
					<div className="tq-field">
						<label htmlFor={`${name}-file`} className="tq-label">Tệp SVG (tối đa 50 KB)</label>
						<input id={`${name}-file`} type="file" accept=".svg,image/svg+xml" className="tq-input" onChange={(e) => void readFile(e.target.files?.[0])} />
					</div>
					<div className="tq-field">
						<label htmlFor={`${name}-svg`} className="tq-label">Hoặc dán mã SVG</label>
						<textarea id={`${name}-svg`} className="tq-input" rows={5} spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== svgState.cleaned && void clean(draft)} style={{ fontFamily: "monospace", fontSize: 12 }} />
						<p className="tq-hint">Hệ thống chỉ giữ lại hình vẽ cơ bản (đường, hình tròn, chữ nhật…). Script, liên kết, kiểu dáng và ảnh nhúng bị bỏ.</p>
					</div>
					<Button variant="secondary" busy={svgState.busy} onClick={() => void clean(draft)}>Làm sạch và xem trước</Button>
					{svgState.error ? <Alert kind="error">{svgState.error}</Alert> : null}
					{svgState.cleaned ? <p className="tq-hint">Đã làm sạch ({svgState.cleaned.length} ký tự). Hệ thống sẽ làm sạch lại khi lưu.</p> : null}
				</div>
			) : null}

			{value.iconType === "image" ? (
				<div>
					<p className="tq-hint">Ảnh PNG hoặc WebP nền trong suốt cho kết quả đẹp nhất. Tải ảnh mới lên ngay trong thư viện bên dưới.</p>
					{value.iconUrl ? (
						<p style={{ display: "flex", alignItems: "center", gap: 10 }}>
							<img src={value.iconUrl} alt="" width={48} height={48} style={{ objectFit: "contain", background: "var(--tq-line-soft)", borderRadius: 8 }} />
							<span className="tq-muted" style={{ wordBreak: "break-all" }}>{value.iconMediaId ? "Ảnh trong thư viện" : value.iconUrl}</span>
						</p>
					) : null}
					{picking ? (
						<MediaPicker
							onCancel={() => setPicking(false)}
							onPick={(item: MediaItem) => {
								onChange({ ...value, iconType: "image", iconMediaId: item.id, iconUrl: item.url });
								setPicking(false);
							}}
						/>
					) : (
						<Button variant="secondary" onClick={() => setPicking(true)}>{value.iconUrl ? "Đổi ảnh" : "Chọn hoặc tải ảnh lên"}</Button>
					)}
				</div>
			) : null}

			{showColor ? (
				<div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginTop: 14 }}>
					<div className="tq-field" style={{ margin: 0 }}>
						<label htmlFor={`${name}-color`} className="tq-label">Màu icon</label>
						<input id={`${name}-color`} type="color" value={value.iconColor || "#835414"} onChange={(e) => onChange({ ...value, iconColor: e.target.value })} style={{ width: 56, height: 40, padding: 2 }} />
					</div>
					<span className="tq-muted" style={{ paddingBottom: 8 }}>{value.iconColor || "Màu mặc định của trang"}</span>
					{value.iconColor ? <Button variant="link" onClick={() => onChange({ ...value, iconColor: "" })}>Dùng màu mặc định</Button> : null}
				</div>
			) : null}

			<div style={{ marginTop: 14 }}>
				<p className="tq-label" style={{ marginBottom: 6 }}>Xem trước</p>
				<IconPreview icon={value} svg={previewSvg} label={label || "mục này"} />
			</div>
		</fieldset>
	);
}
