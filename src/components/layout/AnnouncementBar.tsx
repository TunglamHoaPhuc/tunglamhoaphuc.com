import Link from "next/link";
import { type Announcement, site } from "@/config/site";
import { announcementEndsAt, currentAnnouncement, DISMISS_KEY } from "@/libs/announcement";
import AnnouncementClose from "./AnnouncementClose";

// Runs while the page is still parsing, before first paint: hides a notice the visitor
// closed earlier this session (or one that expired after the page was rendered), else
// tells the floating header how far down to sit.
const SYNC_SCRIPT = `(function(){var b=document.currentScript.previousElementSibling,r=document.documentElement,h=Date.now()>+b.dataset.endsAt;try{h=h||sessionStorage.getItem(${JSON.stringify(DISMISS_KEY)})===b.dataset.id}catch(e){}if(h)r.setAttribute("data-announcement-hidden","");else r.style.setProperty("--tlhp-announcement-offset",b.offsetHeight+"px")})()`;

/**
 * The temple's notice strip (UX-02): static, in the page flow above the header, with a
 * "Đóng" button that keeps it closed for the rest of the session. Renders nothing when
 * there is no current notice.
 */
export default function AnnouncementBar({ announcement: given = site.announcement }: { announcement?: Announcement | null }) {
	const announcement = currentAnnouncement(given);
	if (!announcement) return null;
	return (
		<>
			<aside
				className="tlhp-announcement"
				aria-label="Thông báo của nhà chùa"
				data-id={announcement.id}
				data-ends-at={String(announcementEndsAt(announcement))}
			>
				<div className="container tlhp-announcement-inner">
					<p className="tlhp-announcement-text">
						{announcement.text}
						{announcement.link ? (
							<>
								{" "}
								<Link href={announcement.link.href}>{announcement.link.label}</Link>
							</>
						) : null}
					</p>
					<AnnouncementClose id={announcement.id} />
				</div>
			</aside>
			<script dangerouslySetInnerHTML={{ __html: SYNC_SCRIPT }} />
		</>
	);
}
