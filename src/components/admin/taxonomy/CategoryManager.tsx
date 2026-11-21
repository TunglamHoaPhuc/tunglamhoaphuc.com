"use client";

import { useMemo, useState } from "react";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader } from "../media/imageTools";
import { Alert, Badge, Button, EmptyState, errorText, Loading, PageHeader, SelectField } from "../ui";
import { CategoryForm, type CategoryFormMode } from "./CategoryForm";
import { ReorderableTree, RowButton } from "./ReorderableTree";
import { sameTree, type TreeEntry } from "./treeOps";
import { KIND_LABELS, SECTION_LABELS, type CategoryRow } from "./types";

const DEFAULT_GROUPS = [
	{ kind: "post", section: "dong-chay-hoang-phap" },
	{ kind: "post", section: "tri-tue-phat-phap" },
	{ kind: "post", section: "vu-tru-phat-giao" },
	{ kind: "tong-chi", section: "" },
	{ kind: "about", section: "" },
	{ kind: "event", section: "" },
	{ kind: "assembly", section: "" },
];

const groupKey = (kind: string, section: string) => `${kind}|${section}`;
const groupLabel = (kind: string, section: string) => `${KIND_LABELS[kind] ?? kind}${section ? ` · ${SECTION_LABELS[section] ?? section}` : ""}`;

function usage(row: CategoryRow): string {
	const c = row.counts;
	const parts = [c.posts && `${c.posts} bài viết`, c.teachings && `${c.teachings} bài Tông chỉ`, c.pages && `${c.pages} trang`, c.events && `${c.events} sự kiện`, c.statues && `${c.statues} bảo tượng`, c.children && `${c.children} mục con`].filter(Boolean);
	return parts.length ? parts.join(" · ") : "Chưa có nội dung";
}

export function CategoryManager() {
	const { can } = useAdmin();
	const list = useLoader(() => api<CategoryRow[]>("GET", "categories"), "categories");
	const rows = useMemo(() => list.data ?? [], [list.data]);
	const [group, setGroup] = useState(groupKey("post", "dong-chay-hoang-phap"));
	const [order, setOrder] = useState<TreeEntry[] | null>(null);
	const [form, setForm] = useState<CategoryFormMode | null>(null);
	const [confirmId, setConfirmId] = useState<string | null>(null);
	const [notice, setNotice] = useState("");
	const [problem, setProblem] = useState("");
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState("");

	const groups = useMemo(() => {
		const seen = new Map<string, { kind: string; section: string }>();
		for (const one of DEFAULT_GROUPS) seen.set(groupKey(one.kind, one.section), one);
		for (const row of rows) seen.set(groupKey(row.kind, row.section), { kind: row.kind, section: row.section });
		return [...seen.values()];
	}, [rows]);
	const [kind, section] = group.split("|");
	const inGroup = useMemo(() => rows.filter((row) => row.kind === kind && row.section === section), [rows, kind, section]);
	const serverTree = useMemo<TreeEntry[]>(() => inGroup.map((row) => ({ id: row.id, parentId: row.parentId })), [inGroup]);
	const tree = order ?? serverTree;
	const dirty = order !== null && !sameTree(order, serverTree);
	const canUpdate = can("categories", "update");
	const canCreate = can("categories", "create");
	const canDelete = can("categories", "delete");
	const editing = form?.type === "edit" ? form.row.id : null;

	async function saveOrder() {
		setBusy(true);
		setProblem("");
		setNotice("");
		try {
			await api("POST", "categories/reorder", { items: tree });
			setOrder(null);
			setNotice("Đã lưu thứ tự chuyên mục.");
			list.reload();
		} catch (caught) {
			setProblem(errorText(caught));
		} finally {
			setBusy(false);
		}
	}

	async function remove(row: CategoryRow) {
		setBusy(true);
		setProblem("");
		setNotice("");
		try {
			await api("DELETE", `categories/${encodeURIComponent(row.id)}`);
			setConfirmId(null);
			setNotice(`Đã chuyển "${row.name}" vào thùng rác.`);
			list.reload();
		} catch (caught) {
			setProblem(errorText(caught));
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<PageHeader title="Chuyên mục">
				{canCreate ? (
					<Button disabled={dirty} onClick={() => { setForm({ type: "create", kind, section, parentId: null }); setNotice(""); }}>
						Thêm chuyên mục
					</Button>
				) : null}
			</PageHeader>

			<div className="tq-toolbar">
				<SelectField label="Nhóm chuyên mục" value={group} onChange={(e) => { setGroup(e.target.value); setOrder(null); setForm(null); setConfirmId(null); }} disabled={dirty}>
					{groups.map((one) => (
						<option key={groupKey(one.kind, one.section)} value={groupKey(one.kind, one.section)}>{groupLabel(one.kind, one.section)}</option>
					))}
				</SelectField>
			</div>

			<p className="tq-hint">
				Kéo từng dòng để đổi chỗ (thả vào phần trên hoặc dưới của dòng khác để xếp trước hoặc sau, thả vào giữa để đặt thành mục con), hoặc dùng các nút Lên, Xuống, Thụt vào, Lùi ra. Thứ tự chỉ được lưu khi bấm &quot;Lưu thứ tự&quot;.
			</p>

			{notice ? <Alert kind="success">{notice}</Alert> : null}
			{problem ? <Alert kind="error">{problem}</Alert> : null}
			<div aria-live="polite" className="tq-hint" style={{ minHeight: "1.2em" }}>{status}</div>

			{form ? (
				<CategoryForm
					key={form.type === "edit" ? form.row.id : "new"}
					mode={form}
					parents={inGroup}
					onCancel={() => setForm(null)}
					onSaved={(saved) => {
						setForm(null);
						setNotice(`Đã lưu chuyên mục "${saved.name}".`);
						list.reload();
					}}
				/>
			) : null}

			{list.error ? (
				<>
					<Alert kind="error">{list.error}</Alert>
					<Button variant="secondary" onClick={list.reload}>Thử lại</Button>
				</>
			) : list.data === null ? (
				<Loading />
			) : inGroup.length === 0 ? (
				<EmptyState>Nhóm này chưa có chuyên mục nào.{canCreate ? " Bấm \"Thêm chuyên mục\" để tạo." : ""}</EmptyState>
			) : (
				<>
					<ReorderableTree
						ariaLabel={`Chuyên mục: ${groupLabel(kind, section)}`}
						items={inGroup}
						tree={tree}
						disabled={!canUpdate || busy}
						selectedId={editing}
						label={(row) => row.name}
						onChange={(next, message) => {
							setOrder(next);
							setNotice("");
							setStatus(message);
						}}
						renderRow={({ item }) => (
							<div>
								<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
									<strong>{item.name}</strong>
									{!item.visible ? <Badge tone="warn">Đang ẩn</Badge> : null}
									{item.iconType !== "none" ? <Badge>Có icon</Badge> : null}
								</div>
								<div className="tq-muted" style={{ fontSize: 13 }}>
									<code>{item.path}</code> · {usage(item)}
								</div>
								{confirmId === item.id ? (
									<div role="alert" className="tq-alert tq-alert--warning" style={{ marginTop: 8 }}>
										<p style={{ margin: "0 0 8px" }}>Chuyển &quot;{item.name}&quot; vào thùng rác? {item.used > 0 || item.counts.children > 0 ? "Chuyên mục còn nội dung nên hệ thống sẽ từ chối." : "Bạn có thể khôi phục từ thùng rác."}</p>
										<div style={{ display: "flex", gap: 8 }}>
											<Button variant="danger" busy={busy} onClick={() => void remove(item)}>Xóa chuyên mục</Button>
											<Button variant="secondary" onClick={() => setConfirmId(null)}>Hủy</Button>
										</div>
									</div>
								) : null}
							</div>
						)}
						renderActions={({ item }) => (
							<>
								{canUpdate ? (
									<RowButton aria-label={`Sửa ${item.name}`} onClick={() => { setForm({ type: "edit", row: item }); setNotice(""); }}>
										Sửa
									</RowButton>
								) : null}
								{canDelete ? (
									<RowButton variant="danger" aria-label={`Xóa ${item.name}`} disabled={dirty} onClick={() => { setConfirmId(item.id); setProblem(""); }}>
										Xóa
									</RowButton>
								) : null}
							</>
						)}
					/>
					{canUpdate ? (
						<div className="tq-actions" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
							<Button busy={busy} disabled={!dirty} onClick={() => void saveOrder()}>Lưu thứ tự</Button>
							{dirty ? <Button variant="secondary" disabled={busy} onClick={() => setOrder(null)}>Hủy thay đổi</Button> : null}
							{dirty ? <span className="tq-muted">Có thay đổi chưa lưu. Hãy lưu trước khi thêm, xóa hoặc đổi sang nhóm khác.</span> : null}
						</div>
					) : null}
				</>
			)}
		</>
	);
}
