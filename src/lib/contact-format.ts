// How the footer writes the temple's contact lines. No imports: safe for client components.

export type ContactLine = { role: string; name: string; phone: string };

/** "0979345373" → "0979.345.373", the way the temple writes numbers; other lengths are left as they are. */
export function formatPhone(digits: string): string {
	return digits.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1.$2.$3");
}

/** Contacts grouped under their role, in the order the roles first appear. */
export function contactGroups<T extends { role: string }>(contacts: T[]): { role: string; people: T[] }[] {
	const groups: { role: string; people: T[] }[] = [];
	for (const contact of contacts) {
		const group = groups.find(({ role }) => role === contact.role);
		if (group) group.people.push(contact);
		else groups.push({ role: contact.role, people: [contact] });
	}
	return groups;
}
