import { describe, expect, it } from "vitest";
import { canIndent, canMoveDown, canMoveUp, canOutdent, depths, indent, moveDown, moveTo, moveUp, outdent, sameTree, type TreeEntry } from "../../../src/components/admin/taxonomy/treeOps";

// a        (a1, a2)
// b
// c        (c1)
const LIST: TreeEntry[] = [
	{ id: "a", parentId: null },
	{ id: "a1", parentId: "a" },
	{ id: "a2", parentId: "a" },
	{ id: "b", parentId: null },
	{ id: "c", parentId: null },
	{ id: "c1", parentId: "c" },
];
/** "parent>id" for each entry, "-" for the top. */
const show = (list: TreeEntry[]) => list.map((entry) => `${entry.parentId ?? "-"}>${entry.id}`).join(" ");

describe("moving inside the tree", () => {
	it("moves a brother up and down, taking its children along", () => {
		expect(show(moveUp(LIST, "b"))).toBe("->b ->a a>a1 a>a2 ->c c>c1");
		expect(show(moveDown(LIST, "a"))).toBe("->b ->a a>a1 a>a2 ->c c>c1");
		expect(show(moveUp(LIST, "c"))).toBe("->a a>a1 a>a2 ->c c>c1 ->b");
		expect(show(moveUp(LIST, "a2"))).toBe("->a a>a2 a>a1 ->b ->c c>c1");
	});

	it("does nothing at the ends and for unknown ids", () => {
		expect(moveUp(LIST, "a")).toBe(LIST);
		expect(moveDown(LIST, "c")).toBe(LIST);
		expect(moveUp(LIST, "a1")).toBe(LIST);
		expect(moveDown(LIST, "a2")).toBe(LIST);
		expect(moveUp(LIST, "khong-co")).toBe(LIST);
		expect(canMoveUp(LIST, "a")).toBe(false);
		expect(canMoveUp(LIST, "a2")).toBe(true);
		expect(canMoveDown(LIST, "a2")).toBe(false);
		expect(canMoveDown(LIST, "a1")).toBe(true);
	});

	it("indents under the brother above (as its last child) and outdents after its parent", () => {
		expect(show(indent(LIST, "b"))).toBe("->a a>a1 a>a2 a>b ->c c>c1");
		expect(show(indent(LIST, "c"))).toBe("->a a>a1 a>a2 ->b b>c c>c1");
		expect(indent(LIST, "a")).toBe(LIST);
		expect(show(outdent(LIST, "a1"))).toBe("->a a>a2 ->a1 ->b ->c c>c1");
		expect(show(outdent(LIST, "c1"))).toBe("->a a>a1 a>a2 ->b ->c ->c1");
		expect(outdent(LIST, "b")).toBe(LIST);
		expect(canIndent(LIST, "b")).toBe(true);
		expect(canOutdent(LIST, "a1")).toBe(true);
		expect(canOutdent(LIST, "a")).toBe(false);
	});

	it("drops before, after or inside another entry, and refuses a drop into its own branch", () => {
		expect(show(moveTo(LIST, "b", "a1", "before"))).toBe("->a a>b a>a1 a>a2 ->c c>c1");
		expect(show(moveTo(LIST, "b", "a1", "after"))).toBe("->a a>a1 a>b a>a2 ->c c>c1");
		expect(show(moveTo(LIST, "a", "c", "inside"))).toBe("->b ->c c>c1 c>a a>a1 a>a2");
		expect(show(moveTo(LIST, "c1", "a", "before"))).toBe("->c1 ->a a>a1 a>a2 ->b ->c");
		expect(moveTo(LIST, "a", "a1", "inside")).toBe(LIST);
		expect(moveTo(LIST, "a", "a", "after")).toBe(LIST);
		expect(moveTo(LIST, "a", "khong-co", "after")).toBe(LIST);
	});

	it("never changes the list it was given, and keeps every entry", () => {
		const before = JSON.stringify(LIST);
		const result = moveTo(LIST, "a", "c1", "after");
		expect(JSON.stringify(LIST)).toBe(before);
		expect(result.map((entry) => entry.id).sort()).toEqual(LIST.map((entry) => entry.id).sort());
	});

	it("reads depth, treats a missing parent as the top, and compares trees", () => {
		expect(Object.fromEntries(depths(LIST))).toEqual({ a: 0, a1: 1, a2: 1, b: 0, c: 0, c1: 1 });
		expect(show(moveUp([{ id: "x", parentId: "gone" }, { id: "y", parentId: null }], "y"))).toBe("->y ->x");
		expect(sameTree(LIST, [...LIST])).toBe(true);
		expect(sameTree(LIST, indent(LIST, "b"))).toBe(false);
	});
});
