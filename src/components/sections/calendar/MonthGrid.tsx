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

/** Lunar day as the calendar shows it: "1/10" on the first, "Rằm" on the 15th. */
function lunarLabel(day: CalendarDay): string {
	if (day.lunar.day === 1) return shortLunar(day.lunar);
	if (day.lunar.day === 15) return "Rằm";
	return String(day.lunar.day);
}

// The month as a table, Monday to Sunday: the day, its lunar date under it, and the names
// of the day's events. A day with events is one link (a large target) to its first event's
// card; the cards below list the same events in full, for screen readers too.
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
												// On phones the name is read out but drawn as a dot.
												<span key={event.id} className={`tlhp-day-event is-${event.category.slug}`}>
													<span className="tlhp-day-event-name">{event.title}</span>
												</span>
											))}
										</span>
									) : null}
								</>
							);
							return (
								<td
									key={day.date}
									className={[day.today ? "is-today" : "", day.events.length ? "has-events" : "", idx === 6 ? "is-sunday" : ""].filter(Boolean).join(" ") || undefined}
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
