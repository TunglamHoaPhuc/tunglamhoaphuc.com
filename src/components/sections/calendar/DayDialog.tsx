"use client";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";

/** What the dialog shows of an event or a ceremony, prepared on the server. */
export type DialogEvent = {
	id: string;
	title: string;
	subtitle: string;
	category: { slug: string; name: string };
	/** "Thứ Bảy, 07/11/2026" or "09/11 – 18/11/2026". */
	solar: string;
	/** "29/9 Bính Ngọ". */
	lunar: string;
	times: { label: string; time: string }[];
	location: string;
	description: string;
	notes: string;
	image: { src: string; position: string } | null;
	icon: string | null;
	/** The event's own page. */
	href: string;
};

type Props = {
	events: DialogEvent[];
	/** The events of each day of the month, by date. */
	days: Record<string, string[]>;
	children: ReactNode;
	className?: string;
};

// A day of the calendar opens a dialog with its events, as on the old site: the picture, the
// type's mark, the second name and the name, the days in both calendars and the time, the
// editors' text, where, the advice, and the way to the event's page. The browser's own modal
// dialog keeps the focus inside, closes on Esc and gives the focus back to the day. Without
// JavaScript (or with a modifier key) the day's link leads to the event's card below.
export default function DayDialog({ events, days, children, className }: Props) {
	const dialog = useRef<HTMLDialogElement>(null);
	const [date, setDate] = useState<string | null>(null);
	const shown = date ? (days[date] ?? []).map((id) => events.find((event) => event.id === id)).filter((event): event is DialogEvent => !!event) : [];

	const onClick = (event: MouseEvent<HTMLDivElement>) => {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = (event.target as Element).closest<HTMLAnchorElement>("a.tlhp-day[data-date]");
		const day = link?.dataset.date;
		if (!day || !days[day]?.length) return;
		event.preventDefault();
		setDate(day);
	};

	// Open once the day's events are drawn, at their top: opened before, the browser kept the
	// scroll it gave the empty box and the close button sat above the edge.
	useEffect(() => {
		const box = dialog.current;
		if (!date || !box || box.open) return;
		box.showModal();
		box.scrollTop = 0;
	}, [date]);

	// A click on the backdrop (the dialog itself, outside its box) closes it.
	const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
		if (event.target === dialog.current) dialog.current.close();
	};

	return (
		<>
			<div className={className} onClick={onClick}>
				{children}
			</div>
			<dialog ref={dialog} className="tlhp-day-dialog" aria-labelledby="lich-hop-thoai-tieu-de" onClick={onDialogClick} onClose={() => setDate(null)}>
				<div className="tlhp-day-dialog-box">
					<form method="dialog">
						<button type="submit" className="tlhp-day-dialog-close" aria-label="Đóng">
							<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
								<path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
							</svg>
						</button>
					</form>
					<h2 id="lich-hop-thoai-tieu-de" className="visually-hidden">
						{shown.length > 1 ? `${shown.length} sự kiện trong ngày` : "Sự kiện trong ngày"}
					</h2>
					{shown.map((item) => (
						<article key={item.id} className="tlhp-day-dialog-event" aria-label={item.title}>
							<div className="tlhp-day-dialog-media">
								{item.image ? <img src={item.image.src} alt="" width={640} height={360} style={{ objectPosition: item.image.position }} /> : null}
								<span className="tlhp-day-dialog-mark" aria-hidden="true">
									{item.icon ? <img src={item.icon} alt="" width={28} height={28} /> : null}
								</span>
							</div>
							<div className="tlhp-day-dialog-body">
								{item.subtitle ? <p className="tlhp-day-dialog-subtitle">{item.subtitle}</p> : null}
								<h3 className="tlhp-day-dialog-title">{item.title}</h3>
								<div className="tlhp-day-dialog-when">
									<p>
										<strong>{item.solar}</strong>
										<span>Âm lịch {item.lunar}</span>
									</p>
									{item.times.length ? (
										<dl>
											{item.times.map((slot, index) => (
												<div key={index}>
													<dt>{slot.label || "Thời gian"}</dt>
													<dd>{slot.time || "–"}</dd>
												</div>
											))}
										</dl>
									) : null}
								</div>
								{item.description ? <p className="tlhp-day-dialog-desc">{item.description}</p> : null}
								{item.location ? (
									<p className="tlhp-day-dialog-place">
										<i className="tji-location" aria-hidden="true"></i> {item.location}
									</p>
								) : null}
								{item.notes ? (
									<p className="tlhp-day-dialog-notes">
										<strong>Lưu ý hành trì:</strong> {item.notes}
									</p>
								) : null}
								<a className="tlhp-day-dialog-more" href={item.href}>
									Xem chi tiết <span className="visually-hidden">{item.title}</span>
									<i className="tji-arrow-right" aria-hidden="true"></i>
								</a>
							</div>
						</article>
					))}
				</div>
			</dialog>
		</>
	);
}
