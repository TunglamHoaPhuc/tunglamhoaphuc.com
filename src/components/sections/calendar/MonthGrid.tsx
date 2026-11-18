import { type CalendarDay, WEEKDAY_SHORT, weekdayName } from "@/libs/calendar";
import { lunarMonthName, shortLunar } from "@/libs/lunar";

type Props = {
	weeks: (CalendarDay | null)[][];
	/** "11/2026". */
	label: string;
	/** Where a day's link leads: its first event's card on this page. */
	hrefFor: (day: CalendarDay) => string;
	/** Id of the note saying the full list follows. */
	describedBy: string;
};

const WEEKDAY_FULL = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

/** The old calendar's icon of each type of event (public/brand/icons); other types get a dot. */
export const EVENT_ICONS: Record<string, string> = {
	"khoa-le-truyen-thong": "/brand/icons/icon-khoa-le-truyen-thong.webp",
	"cong-tu": "/brand/icons/icon-cong-tu.webp",
	"dai-le-su-kien": "/brand/icons/icon-dai-le-su-kien.webp",
};

/** Lunar day as the calendar shows it: "1/10" on the first, "Rằm" on the 15th. */
function lunarLabel(day: CalendarDay): string {
	if (day.lunar.day === 1) return shortLunar(day.lunar);
	if (day.lunar.day === 15) return "Rằm";
	return String(day.lunar.day);
}

// The month as a table, Monday to Sunday, drawn as the old site's calendar: the day, its
// lunar date beside it (in red on the 1st and the 15th), and an icon for each event or
// ceremony of the day, its name shown on hover and read by screen readers. Days of an event
// lasting several days glow; today glows most. A day with events is one link (a large
// target) to its first event's card.
export default function MonthGrid({ weeks, label, hrefFor, describedBy }: Props) {
	return (
		<table className="tlhp-month" aria-describedby={describedBy}>
			<caption className="visually-hidden">Lịch tháng {label}, kèm ngày âm lịch</caption>
			<thead>
				<tr>
					{WEEKDAY_SHORT.map((short, idx) => (
						<th key={short} scope="col" className={idx === 6 ? "is-sunday" : undefined}>
							<abbr title={WEEKDAY_FULL[idx]}>{short}</abbr>
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{weeks.map((week, row) => (
					<tr key={row}>
						{week.map((day, idx) => {
							if (!day) return <td key={idx} className="is-outside" />;
							const lunarSpecial = day.lunar.day === 1 || day.lunar.day === 15;
							const content = (
								<>
									{/* Read as "Thứ Bảy, ngày 7 âm lịch ngày 29 tháng Chín: PHÁP HỘI…".
									    Hidden text is set apart by a space, so no comma follows the 7. */}
									<span className="tlhp-day-solar">
										<span className="visually-hidden">{weekdayName(day.date)}, ngày </span>
										{day.day}
									</span>
									<span className={`tlhp-day-lunar${lunarSpecial ? " is-special" : ""}`}>
										<span className="visually-hidden">
											âm lịch ngày {day.lunar.day} {lunarMonthName(day.lunar.month, day.lunar.leap)}
											{day.events.length ? ":" : ""}
										</span>
										<span aria-hidden="true">{lunarLabel(day)}</span>
									</span>
									{day.events.length ? (
										<span className="tlhp-day-events">
											{day.events.map((event) => (
												<span key={event.id} className={`tlhp-day-event is-${event.category.slug}${event.start !== event.end ? " is-long" : ""}`}>
													{EVENT_ICONS[event.category.slug] ? <img src={EVENT_ICONS[event.category.slug]} alt="" width={24} height={24} loading="lazy" decoding="async" /> : <span className="tlhp-day-event-dot" />}
													<span className="visually-hidden">{event.title}</span>
													<span className="tlhp-day-event-name" aria-hidden="true">
														{event.title}
													</span>
												</span>
											))}
										</span>
									) : null}
								</>
							);
							return (
								<td
									key={day.date}
									className={[day.today ? "is-today" : "", day.events.length ? "has-events" : "", day.events.some((event) => event.start !== event.end) ? "in-range" : "", idx === 6 ? "is-sunday" : ""].filter(Boolean).join(" ") || undefined}
									aria-current={day.today ? "date" : undefined}
								>
									{day.events.length ? (
										<a className="tlhp-day" href={hrefFor(day)}>
											{content}
										</a>
									) : (
										<span className="tlhp-day">{content}</span>
									)}
								</td>
							);
						})}
					</tr>
				))}
			</tbody>
		</table>
	);
}
