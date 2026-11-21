// Moves inside a tree kept as a flat list in display order: each entry names its parent. Every move gives a new
// list (the old one is untouched); a move that cannot be made gives the same list back. Used by the category and menu
// screens for the buttons (Lên / Xuống / Thụt vào / Lùi ra) and for drag and drop.
export type TreeEntry = { id: string; parentId: string | null };
export type DropPlace = "before" | "after" | "inside";

type Shape = { children: Map<string | null, string[]>; parentOf: Map<string, string | null> };

function shape(list: TreeEntry[]): Shape {
	const known = new Set(list.map((entry) => entry.id));
	const children = new Map<string | null, string[]>();
	const parentOf = new Map<string, string | null>();
	for (const entry of list) {
		// A parent that is not in the list counts as the top.
		const parent = entry.parentId && known.has(entry.parentId) && entry.parentId !== entry.id ? entry.parentId : null;
		parentOf.set(entry.id, parent);
		children.set(parent, [...(children.get(parent) ?? []), entry.id]);
	}
	return { children, parentOf };
}

function flatten({ children }: Shape): TreeEntry[] {
	const out: TreeEntry[] = [];
	const seen = new Set<string>();
	const walk = (parent: string | null) => {
		for (const id of children.get(parent) ?? []) {
			if (seen.has(id)) continue;
			seen.add(id);
			out.push({ id, parentId: parent });
			walk(id);
		}
	};
	walk(null);
	return out;
}

const siblings = (s: Shape, id: string) => s.children.get(s.parentOf.get(id) ?? null) ?? [];
const detach = (s: Shape, id: string) => {
	const parent = s.parentOf.get(id) ?? null;
	s.children.set(parent, (s.children.get(parent) ?? []).filter((one) => one !== id));
};
const insert = (s: Shape, id: string, parent: string | null, index: number) => {
	const arr = [...(s.children.get(parent) ?? [])];
	arr.splice(Math.max(0, Math.min(index, arr.length)), 0, id);
	s.children.set(parent, arr);
	s.parentOf.set(id, parent);
};

/** Whether `id` is `ancestor` or lies below it. */
export function isInside(list: TreeEntry[], id: string, ancestor: string): boolean {
	const s = shape(list);
	let cursor: string | null | undefined = id;
	for (let guard = 0; cursor && guard <= list.length; guard++) {
		if (cursor === ancestor) return true;
		cursor = s.parentOf.get(cursor);
	}
	return false;
}

export const canMoveUp = (list: TreeEntry[], id: string) => {
	const s = shape(list);
	return s.parentOf.has(id) && siblings(s, id).indexOf(id) > 0;
};
export const canMoveDown = (list: TreeEntry[], id: string) => {
	const s = shape(list);
	const arr = siblings(s, id);
	return s.parentOf.has(id) && arr.indexOf(id) >= 0 && arr.indexOf(id) < arr.length - 1;
};
export const canIndent = canMoveUp;
export const canOutdent = (list: TreeEntry[], id: string) => (shape(list).parentOf.get(id) ?? null) !== null;

export function moveUp(list: TreeEntry[], id: string): TreeEntry[] {
	if (!canMoveUp(list, id)) return list;
	const s = shape(list);
	const index = siblings(s, id).indexOf(id);
	const parent = s.parentOf.get(id) ?? null;
	detach(s, id);
	insert(s, id, parent, index - 1);
	return flatten(s);
}

export function moveDown(list: TreeEntry[], id: string): TreeEntry[] {
	if (!canMoveDown(list, id)) return list;
	const s = shape(list);
	const index = siblings(s, id).indexOf(id);
	const parent = s.parentOf.get(id) ?? null;
	detach(s, id);
	insert(s, id, parent, index + 1);
	return flatten(s);
}

/** Becomes the last child of the brother just above. */
export function indent(list: TreeEntry[], id: string): TreeEntry[] {
	if (!canIndent(list, id)) return list;
	const s = shape(list);
	const arr = siblings(s, id);
	const above = arr[arr.indexOf(id) - 1];
	detach(s, id);
	insert(s, id, above, Infinity);
	return flatten(s);
}

/** Becomes a brother of its parent, right after it. */
export function outdent(list: TreeEntry[], id: string): TreeEntry[] {
	if (!canOutdent(list, id)) return list;
	const s = shape(list);
	const parent = s.parentOf.get(id) as string;
	const grand = s.parentOf.get(parent) ?? null;
	const at = (s.children.get(grand) ?? []).indexOf(parent);
	detach(s, id);
	insert(s, id, grand, at + 1);
	return flatten(s);
}

/** Drops `id` (with everything below it) before, after or inside `target`; not onto itself or into its own branch. */
export function moveTo(list: TreeEntry[], id: string, target: string, place: DropPlace): TreeEntry[] {
	if (id === target || isInside(list, target, id)) return list;
	const s = shape(list);
	if (!s.parentOf.has(id) || !s.parentOf.has(target)) return list;
	detach(s, id);
	if (place === "inside") insert(s, id, target, Infinity);
	else {
		const parent = s.parentOf.get(target) ?? null;
		const at = (s.children.get(parent) ?? []).indexOf(target);
		insert(s, id, parent, place === "before" ? at : at + 1);
	}
	return flatten(s);
}

/** Depth of every entry (0 at the top). */
export function depths(list: TreeEntry[]): Map<string, number> {
	const s = shape(list);
	const out = new Map<string, number>();
	for (const entry of list) {
		let depth = 0;
		for (let cursor = s.parentOf.get(entry.id); cursor && depth <= list.length; cursor = s.parentOf.get(cursor)) depth++;
		out.set(entry.id, depth);
	}
	return out;
}

export const sameTree = (a: TreeEntry[], b: TreeEntry[]) => a.length === b.length && a.every((entry, i) => entry.id === b[i].id && entry.parentId === b[i].parentId);
