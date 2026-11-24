import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../../../src/admin/content/html";

describe("checklist (TipTap task list)", () => {
	it("keeps the task list and item markers with a normalised checked state", () => {
		const html = '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Xong</p></li><li data-type="taskItem" data-checked="false"><p>Chưa</p></li></ul>';
		expect(sanitizeHtml(html)).toBe(html);
	});
	it("drops the checkbox the editor draws and keeps the text", () => {
		const out = sanitizeHtml('<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Việc</p></div></li></ul>');
		expect(out).toBe('<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Việc</p></li></ul>');
		expect(out).not.toMatch(/input|label/);
	});
	it("turns any value other than true into false and drops unknown markers and attributes", () => {
		const out = sanitizeHtml('<ul data-type="evil" onclick="x()" class="a" style="position: fixed"><li data-type="taskItem" data-checked="javascript:1" onclick="x()" id="i" data-x="1">a</li><li data-type="other" data-checked="true">b</li></ul>');
		expect(out).toBe('<ul><li data-type="taskItem" data-checked="false">a</li><li>b</li></ul>');
	});
});
