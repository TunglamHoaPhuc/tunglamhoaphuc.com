import { lunarRange, weekdayName } from "@/libs/calendar";
import Link from "next/link";

const dayMonth = (isoDate) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;

/** "Cộng Tu · Pháp hội (Khai Đàn)"; a subtitle that only repeats the type is left out. */
const typeLine = (event) => {
	const same = event.subtitle.toLocaleLowerCase("vi") === event.category.name.toLocaleLowerCase("vi");
	return [event.category.name, same ? "" : event.subtitle].filter(Boolean).join(" · ");
};

/**
 * Bexon's plan boxes, one per event: the countdown, the name and type, the day where the
 * price was, "Xem chi tiết" to its card on the schedule page, then the lunar day, the times
 * and the place where the plan's features were. The nearest event is the highlighted box.
 * @param {{ events: import("@/libs/home").UpcomingEvent[] }} props
 */
const PricingPlanItems = ({ events }) => {
	return events.map(({ event, href, countdown }, idx) => (
		<div key={event.id} className="col-xl-4 col-md-6">
			<article
				className={`pricing-box tlhp-upcoming-card${idx === 0 ? " active" : ""} wow fadeInUp`}
				data-wow-delay={`.${5 + idx * 2}s`}
				aria-labelledby={`khoa-tu-${event.id}`}
			>
				<div className="pricing-header">
					<p className="tlhp-upcoming-countdown">{countdown}</p>
					<h3 id={`khoa-tu-${event.id}`} className="package-name h4">
						{event.title}
					</h3>
					<div className="package-desc">
						<p>{typeLine(event)}</p>
					</div>
					<div className="package-price">
						<span className="price-number">{dayMonth(event.start)}</span>
						<span className="package-period">
							{event.start === event.end ? weekdayName(event.start) : `đến ${dayMonth(event.end)}`}
						</span>
					</div>
					<div className="pricing-btn">
						<Link href={href} className="text-btn">
							<span className="btn-text">
								<span>Xem chi tiết</span>
							</span>
							<span className="visually-hidden">: {event.title}</span>
							<span className="btn-icon" aria-hidden="true">
								<i className="tji-arrow-right-long"></i>
							</span>
						</Link>
					</div>
				</div>
				<div className="list-items">
					<ul>
						<li>
							<i className="tji-list" aria-hidden="true"></i>Âm lịch {lunarRange(event)}
						</li>
						{event.times.map((slot, slotIdx) => (
							<li key={slotIdx}>
								<i className="tji-list" aria-hidden="true"></i>
								{[slot.label, slot.time].filter(Boolean).join(": ")}
							</li>
						))}
						{event.location ? (
							<li>
								<i className="tji-list" aria-hidden="true"></i>
								{event.location}
							</li>
						) : null}
					</ul>
				</div>
			</article>
		</div>
	));
};

export default PricingPlanItems;
