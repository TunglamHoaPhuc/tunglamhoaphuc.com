import type { Announcement } from "@/config/site";

/** sessionStorage key holding the id of the notice the visitor closed. */
export const DISMISS_KEY = "tlhp-announcement-dismissed";

/** End of the `expires` day in Vietnam time (UTC+7), or Infinity when it never expires. */
export function announcementEndsAt(announcement: Announcement): number {
	if (!announcement.expires) return Infinity;
	const end = Date.parse(`${announcement.expires}T23:59:59.999+07:00`);
	return Number.isNaN(end) ? Infinity : end;
}

export function isAnnouncementActive(announcement: Announcement, now: number): boolean {
	return Boolean(announcement.text.trim()) && now <= announcementEndsAt(announcement);
}

/** The notice to show on this request, or null. Pages render per request, so "now" is the request time. */
export function currentAnnouncement(announcement: Announcement | null | undefined): Announcement | null {
	return announcement && isAnnouncementActive(announcement, Date.now()) ? announcement : null;
}
