import { afterEach, describe, expect, it, vi } from "vitest";
import { whenIdleAfterLoad } from "@/libs/motion";

// A page in the node test environment: a readyState, load listeners and an idle queue.
function fakePage(readyState: DocumentReadyState) {
	const listeners: (() => void)[] = [];
	const idle: (() => void)[] = [];
	vi.stubGlobal("document", { readyState });
	vi.stubGlobal("window", {
		addEventListener: (type: string, fn: () => void) => type === "load" && listeners.push(fn),
		removeEventListener: (type: string, fn: () => void) => {
			const at = listeners.indexOf(fn);
			if (type === "load" && at >= 0) listeners.splice(at, 1);
		},
		requestIdleCallback: (fn: () => void) => idle.push(fn),
		cancelIdleCallback: () => idle.splice(0),
	});
	return {
		load: () => listeners.splice(0).forEach((fn) => fn()),
		idle: () => idle.splice(0).forEach((fn) => fn()),
	};
}

afterEach(() => vi.unstubAllGlobals());

describe("whenIdleAfterLoad", () => {
	it("waits for the load event, then for idle", () => {
		const page = fakePage("interactive");
		const run = vi.fn();
		whenIdleAfterLoad(run);
		page.idle();
		expect(run).not.toHaveBeenCalled();
		page.load();
		expect(run).not.toHaveBeenCalled();
		page.idle();
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("waits only for idle on a page already loaded", () => {
		const page = fakePage("complete");
		const run = vi.fn();
		whenIdleAfterLoad(run);
		page.idle();
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("never runs once cancelled", () => {
		const page = fakePage("interactive");
		const run = vi.fn();
		const cancel = whenIdleAfterLoad(run);
		cancel();
		page.load();
		page.idle();
		expect(run).not.toHaveBeenCalled();
	});
});
