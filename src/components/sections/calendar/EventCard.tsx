import { type EventStatus, lunarRange, solarRange } from "@/libs/calendar";
import type { ScheduleEvent } from "@/libs/content/types";
import { dateBadge } from "@/libs/format";
import { youtubeEmbed } from "@/libs/video";

type Props = {
	event: ScheduleEvent;
	/** Id of the card, the target of the calendar's day links. */
	anchor: string;
	status: EventStatus;
};

// Bexon's wide blog card as an event of the schedule: a 16:9 picture with the date badge,
// then the status and type, the title, the days in both calendars, the programme, where,
// and the editors' text. The card takes focus when a day of the calendar leads to it.
export default function EventCard({ event, anchor, status }: Props) {
	const badge = dateBadge(event.start);
	return (
		<article id={anchor} className="blog-item style-2 tlhp-event-card" tabIndex={-1} aria-labelledby={`${anchor}-title`}>
			<div className="blog-thumb">
				{event.image ? (
					<img
						src={event.image.src}
						alt=""
						width={640}
						height={360}
						loading="lazy"
						decoding="async"
						style={{ objectPosition: event.image.position }}
					/>
				) : (
					<span className="tlhp-post-card-noimage" />
				)}
				<div className="blog-date" aria-hidden="true">
					<span className="date">{badge.day}</span>
					<span className="month">{badge.month}</span>
				</div>
			</div>
			<div className="blog-content">
				<p className="tlhp-event-chips">
					<span className={`tlhp-status is-${status.key}`}>{status.label}</span>
					{event.category.name ? <span className="tlhp-chip">{event.category.name}</span> : null}
				</p>
				<h3 id={`${anchor}-title`} className="title h4">
					{event.title}
				</h3>
				{event.subtitle ? <p className="tlhp-event-subtitle">{event.subtitle}</p> : null}
				<dl className="tlhp-event-facts">
					<div>
						<dt>Ngày</dt>
						<dd>
							{solarRange(event)}
							<span className="tlhp-event-lunar">Âm lịch {lunarRange(event)}</span>
						</dd>
					</div>
					{event.times.map((slot, idx) => (
						<div key={idx}>
							<dt>{slot.label || "Giờ"}</dt>
							<dd>{slot.time || "–"}</dd>
						</div>
					))}
					{event.location ? (
						<div>
							<dt>Nơi</dt>
							<dd>{event.location}</dd>
						</div>
					) : null}
				</dl>
				{event.description ? <p className="desc">{event.description}</p> : null}
				{event.notes ? (
					<p className="tlhp-event-notes">
						<strong>Lưu ý:</strong> {event.notes}
					</p>
				) : null}
				{event.video ? (
					<a className="text-btn tlhp-event-video" href={youtubeEmbed(event.video.id)} data-type="external" data-gallery={`video-${anchor}`}>
						<span className="btn-text">
							<span>Xem video</span>
						</span>
						<span className="btn-icon" aria-hidden="true">
							<i className="tji-play"></i>
						</span>
						<span className="visually-hidden">: {event.title}</span>
					</a>
				) : null}
			</div>
		</article>
	);
}
