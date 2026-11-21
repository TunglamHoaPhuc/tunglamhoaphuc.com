"use client";

import { useRef, useState, type SyntheticEvent } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Alert, errorText } from "../ui";
import { cropToBlob, postForm, ratioNumber, SHAPES, type MediaDetailData, type MediaItem } from "./imageTools";

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/** Cuts one picture for one frame shape; saving sends the cut and the region (percent of the picture). */
export function CropTool({ item, ratio, onSaved, onCancel }: { item: MediaItem; ratio: string; onSaved: (detail: MediaDetailData) => void; onCancel: () => void }) {
	const aspect = ratioNumber(ratio);
	const shape = SHAPES.find((s) => s.ratio === ratio);
	const imageRef = useRef<HTMLImageElement | null>(null);
	const [crop, setCrop] = useState<PercentCrop | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [loadFailed, setLoadFailed] = useState(false);

	function onLoad(event: SyntheticEvent<HTMLImageElement>) {
		const { width, height } = event.currentTarget;
		setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height), width, height));
	}

	async function save() {
		const image = imageRef.current;
		if (!image || !crop || crop.width <= 0 || crop.height <= 0) return;
		setBusy(true);
		setError("");
		try {
			const region = { x: clamp(crop.x), y: clamp(crop.y), width: clamp(crop.width), height: clamp(crop.height) };
			const blob = await cropToBlob(image, region);
			const form = new FormData();
			form.append("file", blob, `crop-${ratio.replace(":", "x")}.webp`);
			form.append("region", JSON.stringify(region));
			const detail = await postForm<MediaDetailData>("PUT", `media/${encodeURIComponent(item.id)}/crops/${encodeURIComponent(ratio)}`, form);
			onSaved(detail);
		} catch (caught) {
			setError(errorText(caught));
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className="tq-panel" aria-label={`Cắt ảnh theo khung ${ratio}`} style={{ marginTop: 10 }}>
			<h3 className="tq-h2">Cắt theo khung {ratio}</h3>
			{shape ? <p className="tq-hint">Dùng cho: {shape.hint}. Kéo khung hoặc các góc để chọn vùng giữ lại.</p> : null}
			{error ? <Alert kind="error">{error}</Alert> : null}
			{loadFailed ? <Alert kind="error">Không tải được ảnh để cắt.</Alert> : null}
			<div style={{ maxWidth: "100%", overflow: "auto" }}>
				<ReactCrop crop={crop} aspect={aspect} keepSelection onChange={(_pixels, percent) => setCrop(percent)} disabled={busy}>
					<img ref={imageRef} src={item.url} alt={item.alt || item.filename} onLoad={onLoad} onError={() => setLoadFailed(true)} style={{ maxWidth: "100%", maxHeight: "60vh", display: "block" }} />
				</ReactCrop>
			</div>
			<div className="tq-actions" style={{ marginTop: 10 }}>
				<button type="button" className="tq-btn" disabled={busy || !crop || loadFailed} aria-busy={busy || undefined} onClick={() => void save()}>
					{busy ? "Đang lưu…" : "Lưu bản cắt"}
				</button>
				<button type="button" className="tq-btn tq-btn--secondary" disabled={busy} onClick={onCancel}>
					Hủy
				</button>
			</div>
		</section>
	);
}
