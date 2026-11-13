import { describe, expect, it } from "vitest";
import { contactGroups, site } from "@/config/site";

describe("contacts", () => {
	it("groups people under their role, roles in the order they first appear", () => {
		const groups = contactGroups([
			{ role: "Thư ký", name: "A", phone: "1" },
			{ role: "Hỗ trợ", name: "B", phone: "2" },
			{ role: "Thư ký", name: "C", phone: "3" },
		]);
		expect(groups.map(({ role, people }) => [role, people.map((person) => person.name)])).toEqual([
			["Thư ký", ["A", "C"]],
			["Hỗ trợ", ["B"]],
		]);
	});

	it("keeps every contact of the site, the main number first", () => {
		const groups = contactGroups(site.contacts);
		expect(groups.flatMap((group) => group.people)).toHaveLength(site.contacts.length);
		expect(groups[0].people[0].phone).toBe(site.phone);
	});
});
