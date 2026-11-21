// The event the home page counts down to: the first one, in date order, that begins today or later.
// Shared by the home page and by the admin's "events/next" so the two always agree.
export function nextEvent<T extends { start: string }>(events: readonly T[], today: string): T | undefined {
	return events.find((event) => event.start >= today);
}
