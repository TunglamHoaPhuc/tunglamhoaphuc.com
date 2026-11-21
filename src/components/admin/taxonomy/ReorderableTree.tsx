"use client";

import { useState, type ButtonHTMLAttributes, type DragEvent, type ReactNode } from "react";
import { canIndent, canMoveDown, canMoveUp, canOutdent, depths, indent, moveDown, moveTo, moveUp, outdent, type DropPlace, type TreeEntry } from "./treeOps";

/** A small button for a row's own actions (Sửa, Xóa…). */
export function RowButton({ variant = "secondary", ...button }: { variant?: "secondary" | "danger" } & ButtonHTMLAttributes<HTMLButtonElement>) {
	return <button type="button" className={`tq-btn tq-btn--${variant} tq-btn--small`} {...button} />;
}

export type TreeRowInfo<T> = { entry: TreeEntry; item: T; depth: number };

type Props<T extends { id: string }> = {
	/** The rows in display order; the tree is kept as a flat list of { id, parentId }. */
	items: T[];
	tree: TreeEntry[];
	onChange: (tree: TreeEntry[], message: string) => void;
	label: (item: T) => string;
	/** The content of a row, to the right of the drag handle. */
	renderRow: (row: TreeRowInfo<T>) => ReactNode;
	/** Extra buttons at the end of a row (Sửa, Xóa…). */
	renderActions?: (row: TreeRowInfo<T>) => ReactNode;
	disabled?: boolean;
	/** The id of the row being edited. */
	selectedId?: string | null;
	ariaLabel: string;
};

const MOVES: { key: "up" | "down" | "indent" | "outdent"; text: string; title: string }[] = [
	{ key: "up", text: "Lên", title: "Chuyển lên một vị trí" },
	{ key: "down", text: "Xuống", title: "Chuyển xuống một vị trí" },
	{ key: "indent", text: "Thụt vào", title: "Đặt vào trong mục ngay phía trên (thành mục con)" },
	{ key: "outdent", text: "Lùi ra", title: "Đưa ra ngoài một cấp" },
];

/**
 * A tree whose rows move with buttons (Lên, Xuống, Thụt vào, Lùi ra) or by dragging (native HTML5 drag and drop: drop on the
 * top part of a row to put it before, the bottom part to put it after, the middle to put it inside). Every move is announced
 * in a status line for screen readers. The caller keeps the list and decides when to save it.
 */
export function ReorderableTree<T extends { id: string }>({ items, tree, onChange, label, renderRow, renderActions, disabled, selectedId, ariaLabel }: Props<T>) {
	const [dragId, setDragId] = useState<string | null>(null);
	const [over, setOver] = useState<{ id: string; place: DropPlace } | null>(null);
	const byId = new Map(items.map((item) => [item.id, item]));
	const depth = depths(tree);

	function move(id: string, key: (typeof MOVES)[number]["key"]) {
		const next = key === "up" ? moveUp(tree, id) : key === "down" ? moveDown(tree, id) : key === "indent" ? indent(tree, id) : outdent(tree, id);
		if (next === tree) return;
		const verb = { up: "lên", down: "xuống", indent: "vào trong mục phía trên", outdent: "ra một cấp" }[key];
		onChange(next, `Đã chuyển "${label(byId.get(id) as T)}" ${verb}.`);
	}

	function placeOf(event: DragEvent<HTMLElement>): DropPlace {
		const box = event.currentTarget.getBoundingClientRect();
		const y = (event.clientY - box.top) / Math.max(1, box.height);
		return y < 0.3 ? "before" : y > 0.7 ? "after" : "inside";
	}

	function drop(targetId: string, place: DropPlace) {
		const id = dragId;
		setDragId(null);
		setOver(null);
		if (!id) return;
		const next = moveTo(tree, id, targetId, place);
		if (next === tree) return;
		const where = place === "inside" ? `vào trong "${label(byId.get(targetId) as T)}"` : `${place === "before" ? "trước" : "sau"} "${label(byId.get(targetId) as T)}"`;
		onChange(next, `Đã chuyển "${label(byId.get(id) as T)}" ${where}.`);
	}

	return (
		<ul aria-label={ariaLabel} style={{ listStyle: "none", margin: 0, padding: 0 }}>
			{tree.map((entry) => {
				const item = byId.get(entry.id);
				if (!item) return null;
				const row: TreeRowInfo<T> = { entry, item, depth: depth.get(entry.id) ?? 0 };
				const active = selectedId === entry.id;
				const target = over?.id === entry.id && dragId !== entry.id ? over.place : null;
				return (
					<li key={entry.id} style={{ marginLeft: row.depth * 24, marginBottom: 6 }}>
						<div
							draggable={!disabled}
							onDragStart={(event) => {
								setDragId(entry.id);
								event.dataTransfer.effectAllowed = "move";
								event.dataTransfer.setData("text/plain", entry.id);
							}}
							onDragEnd={() => {
								setDragId(null);
								setOver(null);
							}}
							onDragOver={(event) => {
								if (!dragId || dragId === entry.id) return;
								event.preventDefault();
								const place = placeOf(event);
								setOver((old) => (old?.id === entry.id && old.place === place ? old : { id: entry.id, place }));
							}}
							onDrop={(event) => {
								event.preventDefault();
								drop(entry.id, placeOf(event));
							}}
							style={{
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								gap: 8,
								padding: "8px 10px",
								background: active ? "var(--tq-accent-soft)" : "var(--tq-card)",
								border: `1px solid ${active ? "var(--tq-accent)" : "var(--tq-line)"}`,
								borderRadius: "var(--tq-radius)",
								opacity: dragId === entry.id ? 0.45 : 1,
								cursor: disabled ? "default" : "grab",
								boxShadow: target === "before" ? "0 -3px 0 var(--tq-accent)" : target === "after" ? "0 3px 0 var(--tq-accent)" : target === "inside" ? "inset 0 0 0 2px var(--tq-accent)" : undefined,
							}}
						>
							<span aria-hidden="true" title="Kéo để di chuyển" style={{ color: "var(--tq-muted)", userSelect: "none", letterSpacing: -2 }}>⋮⋮</span>
							<div style={{ flex: "1 1 200px", minWidth: 0 }}>{renderRow(row)}</div>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
								{MOVES.map((one) => {
									const allowed = { up: canMoveUp, down: canMoveDown, indent: canIndent, outdent: canOutdent }[one.key](tree, entry.id);
									return (
										<button key={one.key} type="button" className="tq-btn tq-btn--secondary tq-btn--small" title={one.title} disabled={disabled || !allowed} aria-label={`${one.text}: ${label(item)}`} onClick={() => move(entry.id, one.key)}>
											{one.text}
										</button>
									);
								})}
								{renderActions ? renderActions(row) : null}
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
