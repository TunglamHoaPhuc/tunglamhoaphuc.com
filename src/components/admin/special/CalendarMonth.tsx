"use client";

import Link from "next/link";
import { lunarDate } from "@/libs/lunar";
import { Badge } from "../ui";

export type CalendarEvent = { id: string; title: string; startDate: string; endDate: string; status: string; categoryName: string };

const WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** The weeks of a month (Monday first) as ISO days; days outside the month are null. */
export function monthWeeks(month: string): (string | null)[][] {
	const [year, number] = month.split("-").map(Number);
	const first = new Date(Date.UTC(year, number - 1, 1));
	const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
	const lead = (first.getUTCDay() + 6) % 7;
	const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(Date.UTC(year, number - 1, i + 1))))];
	while (cells.length % 7) cells.push(null);
	return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export const shiftMonth = (month: string, by: number) => {
	const [year, number] = month.split("-").map(Number);
	return iso(new Date(Date.UTC(year, number - 1 + by, 1))).slice(0, 7);
};

const tone = (status: string) => (status === "published" ? "ok" : status === "hidden" ? "warn" : "neutral");
const statusName = (status: string) => (status === "published" ? "Đã xuất bản" : status === "hidden" ? "Tạm ẩn" : "Bản nháp");

/** A plain month grid: the day, its lunar day, and the events that cover it, each a link to its form. */
export function CalendarMonth({ month, events, today, canCreate }: { month: string; events: CalendarEvent[]; today: string; canCreate: boolean }) {
	const weeks = monthWeeks(month);
	return (
		<div className="tq-table-wrap">
			<table className="tq-table" style={{ tableLayout: "fixed", minWidth: 720 }}>
				<caption className="visually-hidden" style={{ position: "absolute", left: -9999 }}>
					Lịch tháng {month.slice(5)}/{month.slice(0, 4)}
				</caption>
				<thead>
					<tr>
						{WEEKDAYS.map((day) => (
							<th key={day} scope="col">
								{day}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{weeks.map((week, index) => (
						<tr key={index}>
							{week.map((day, at) => {
								if (!day) return <td key={at} style={{ background: "var(--tq-line-soft)" }} />;
								const lunar = lunarDate(day);
								const here = events.filter((event) => event.startDate <= day && event.endDate >= day);
								return (
									<td key={day} style={{ verticalAlign: "top", height: 110, background: day === today ? "var(--tq-accent-soft)" : undefined }}>
										<div style={{ display: "flex", justifyContent: "space-between", gap: 4, alignItems: "baseline" }}>
											<strong>{Number(day.slice(8))}</strong>
											<span className="tq-muted" style={{ fontSize: 12 }} title="Ngày âm lịch">
												{lunar.day === 1 ? `1/${lunar.month}${lunar.leap ? "n" : ""} ÂL` : `${lunar.day} ÂL`}
											</span>
										</div>
										<ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0, display: "grid", gap: 4 }}>
											{here.map((event) => (
												<li key={event.id}>
													<Link href={`/quan-tri/lich-tu-hoc/${event.id}`} style={{ fontSize: 13, wordBreak: "break-word" }} aria-label={`${event.title}, ${statusName(event.status)}`}>
														{event.title}
													</Link>{" "}
													{event.status !== "published" ? <Badge tone={tone(event.status)}>{statusName(event.status)}</Badge> : null}
												</li>
											))}
										</ul>
										{canCreate ? (
											<Link href={`/quan-tri/lich-tu-hoc/moi?ngay=${day}`} className="tq-muted" style={{ fontSize: 12 }} aria-label={`Thêm sự kiện ngày ${Number(day.slice(8))}`}>
												+ Thêm
											</Link>
										) : null}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
