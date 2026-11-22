"use client";

import { useMemo, useState } from "react";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader } from "../media/imageTools";
import { Alert, Badge, Button, EmptyState, errorText, Loading, PageHeader } from "../ui";
import { MenuItemForm, type MenuItemFormMode } from "./MenuItemForm";
import { ReorderableTree, RowButton } from "./ReorderableTree";
import { depths, sameTree, type TreeEntry } from "./treeOps";
import type { CategoryRow, MenuData, MenuItemRow } from "./types";

const TABS = [
	{ id: "header", label: "Menu đầu trang" },
	{ id: "footer", label: "Menu chân trang" },
	{ id: "sidebar", label: "Menu bên" },
] as const;

const LINK_LABELS = { category: "Chuyên mục", page: "Trang hoặc bài viết", url: "Địa chỉ" } as const;

export function MenuManager() {
	const { can } = useAdmin();
	const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("header");
	const menu = useLoader(() => api<MenuData>("GET", `menus/${tab}`), tab);
	// The category list (for links to a category) belongs to the Chuyên mục module: without its "view" right it is not asked for and the picker simply has none.
	const canCategories = can("categories", "view");
	const categories = useLoader(() => (canCategories ? api<CategoryRow[]>("GET", "categories") : Promise.resolve<CategoryRow[]>([])), `categories-${canCategories}`);
	const [order, setOrder] = useState<TreeEntry[] | null>(null);
	const [form, setForm] = useState<MenuItemFormMode | null>(null);
	const [confirmId, setConfirmId] = useState<string | null>(null);
	const [notice, setNotice] = useState("");
	const [problem, setProblem] = useState("");
	const [status, setStatus] = useState("");
	const [busy, setBusy] = useState(false);

	const current = menu.data && menu.data.id === tab ? menu.data : null;
	const items = useMemo(() => current?.items ?? [], [current]);
	const serverTree = useMemo<TreeEntry[]>(() => items.map((item) => ({ id: item.id, parentId: item.parentId })), [items]);
	const tree = order ?? serverTree;
	const dirty = order !== null && !sameTree(order, serverTree);
	const canCreate = can("menus", "create");
	const canUpdate = can("menus", "update");
	const canDelete = can("menus", "delete");
	const depth = depths(tree);
	const deepest = Math.max(0, ...tree.map((entry) => depth.get(entry.id) ?? 0)) + 1;
	const shown = current?.shownLevels ?? null;

	function switchTab(next: (typeof TABS)[number]["id"]) {
		if (dirty) return;
		setTab(next);
		setOrder(null);
		setForm(null);
		setConfirmId(null);
		setNotice("");
		setProblem("");
		setStatus("");
	}

	async function saveTree() {
		setBusy(true);
		setProblem("");
		setNotice("");
		try {
			await api<MenuData>("PUT", `menus/${tab}/tree`, { items: tree });
			setOrder(null);
			setNotice("Đã lưu thứ tự menu.");
			menu.reload();
		} catch (caught) {
			setProblem(errorText(caught));
		} finally {
			setBusy(false);
		}
	}

	async function remove(item: MenuItemRow) {
		setBusy(true);
		setProblem("");
		try {
			const result = await api<{ removed: number }>("DELETE", `menu-items/${encodeURIComponent(item.id)}`);
			setConfirmId(null);
			setNotice(result.removed > 1 ? `Đã chuyển "${item.label}" và ${result.removed - 1} mục con vào thùng rác.` : `Đã chuyển "${item.label}" vào thùng rác.`);
			menu.reload();
		} catch (caught) {
			setProblem(errorText(caught));
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<PageHeader title="Menu và icon">
				{canCreate ? (
					<Button disabled={dirty} onClick={() => { setForm({ type: "create", menuId: tab }); setNotice(""); }}>
						Thêm mục
					</Button>
				) : null}
			</PageHeader>

			<div role="tablist" aria-label="Chọn menu" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
				{TABS.map((one) => (
					<button
						key={one.id}
						type="button"
						role="tab"
						id={`tab-${one.id}`}
						aria-selected={tab === one.id}
						aria-controls="menu-panel"
						disabled={dirty && tab !== one.id}
						className={`tq-btn tq-btn--${tab === one.id ? "primary" : "secondary"}`}
						onClick={() => switchTab(one.id)}
					>
						{one.label}
					</button>
				))}
			</div>

			<div id="menu-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
				<Alert kind="info">
					{tab === "header"
						? "Trang công khai hiện chỉ hiển thị hai cấp của menu đầu trang (mục chính và mục con trong danh sách thả xuống). Các cấp sâu hơn vẫn được lưu."
						: "Menu này được lưu và quản lý ở đây nhưng trang công khai chưa hiển thị nó."}
				</Alert>
				<p className="tq-hint">
					Kéo từng dòng để đổi chỗ (thả vào phần trên hoặc dưới của dòng khác để xếp trước hoặc sau, thả vào giữa để đặt thành mục con), hoặc dùng các nút Lên, Xuống, Thụt vào, Lùi ra. Thứ tự chỉ được lưu khi bấm &quot;Lưu thứ tự&quot;.
				</p>

				{notice ? <Alert kind="success">{notice}</Alert> : null}
				{problem ? <Alert kind="error">{problem}</Alert> : null}
				{shown !== null && deepest > shown ? <Alert kind="warning">Cây hiện có {deepest} cấp. Trang công khai chỉ hiển thị {shown} cấp đầu; các mục sâu hơn được lưu nhưng chưa hiện ra.</Alert> : null}
				{current?.warnings.filter((text) => !/chưa hiển thị/.test(text) && !/chỉ hiển thị/.test(text)).map((text) => <Alert key={text} kind="warning">{text}</Alert>)}
				<div aria-live="polite" className="tq-hint" style={{ minHeight: "1.2em" }}>{status}</div>

				{form ? (
					<MenuItemForm
						key={form.type === "edit" ? form.row.id : "new"}
						mode={form}
						categories={categories.data ?? []}
						parents={items}
						onCancel={() => setForm(null)}
						onSaved={(saved) => {
							setForm(null);
							setNotice(`Đã lưu mục "${saved.label}".`);
							// A change to the fields of an item keeps the order being arranged; adding an item starts from the server's tree.
							menu.reload();
						}}
					/>
				) : null}

				{menu.error ? (
					<>
						<Alert kind="error">{menu.error}</Alert>
						<Button variant="secondary" onClick={menu.reload}>Thử lại</Button>
					</>
				) : !current ? (
					<Loading />
				) : items.length === 0 ? (
					<EmptyState>Menu này chưa có mục nào.{canCreate ? " Bấm \"Thêm mục\" để tạo." : ""}</EmptyState>
				) : (
					<>
						<ReorderableTree
							ariaLabel={`Các mục của ${current.name}`}
							items={items}
							tree={tree}
							disabled={!canUpdate || busy}
							selectedId={form?.type === "edit" ? form.row.id : null}
							label={(item) => item.label}
							onChange={(next, message) => {
								setOrder(next);
								setNotice("");
								setStatus(message);
							}}
							renderRow={({ item, depth: level }) => (
								<div>
									<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
										<strong>{item.label}</strong>
										{!item.visible ? <Badge tone="warn">Đang ẩn</Badge> : null}
										{item.openNewTab ? <Badge>Tab mới</Badge> : null}
										{item.iconType !== "none" ? <Badge>Có icon</Badge> : null}
										{shown !== null && level >= shown ? <Badge tone="warn">Chưa hiện ra trang</Badge> : null}
									</div>
									<div className="tq-muted" style={{ fontSize: 13 }}>
										{LINK_LABELS[item.linkType]}: <code>{item.href}</code>
									</div>
									{confirmId === item.id ? (
										<div role="alert" className="tq-alert tq-alert--warning" style={{ marginTop: 8 }}>
											<p style={{ margin: "0 0 8px" }}>
												Chuyển &quot;{item.label}&quot;{tree.some((entry) => entry.parentId === item.id) ? " và các mục con của nó" : ""} vào thùng rác? Bạn có thể khôi phục từ thùng rác.
											</p>
											<div style={{ display: "flex", gap: 8 }}>
												<Button variant="danger" busy={busy} onClick={() => void remove(item)}>Xóa mục</Button>
												<Button variant="secondary" onClick={() => setConfirmId(null)}>Hủy</Button>
											</div>
										</div>
									) : null}
								</div>
							)}
							renderActions={({ item }) => (
								<>
									{canUpdate ? (
										<RowButton aria-label={`Sửa ${item.label}`} onClick={() => { setForm({ type: "edit", row: item }); setNotice(""); }}>
											Sửa
										</RowButton>
									) : null}
									{canDelete ? (
										<RowButton variant="danger" aria-label={`Xóa ${item.label}`} disabled={dirty} onClick={() => { setConfirmId(item.id); setProblem(""); }}>
											Xóa
										</RowButton>
									) : null}
								</>
							)}
						/>
						{canUpdate ? (
							<div className="tq-actions" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
								<Button busy={busy} disabled={!dirty} onClick={() => void saveTree()}>Lưu thứ tự</Button>
								{dirty ? <Button variant="secondary" disabled={busy} onClick={() => setOrder(null)}>Hủy thay đổi</Button> : null}
								{dirty ? <span className="tq-muted">Có thay đổi chưa lưu. Hãy lưu trước khi thêm, xóa hoặc đổi sang menu khác.</span> : null}
							</div>
						) : null}
					</>
				)}
			</div>
		</>
	);
}
