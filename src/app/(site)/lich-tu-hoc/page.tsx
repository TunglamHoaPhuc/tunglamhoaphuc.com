import type { Metadata } from "next";
import Link from "next/link";
import EventCard from "@/components/sections/calendar/EventCard";
import DayDialog, { type DialogEvent } from "@/components/sections/calendar/DayDialog";
import MonthGrid, { EVENT_ICONS } from "@/components/sections/calendar/MonthGrid";
import MonthTheme from "@/components/sections/calendar/MonthTheme";
import HeroInner from "@/components/sections/hero/HeroInner";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import LightboxLinks from "@/components/shared/others/LightboxLinks";
import NoItems from "@/components/shared/others/NoItems";
import { formatPhone, site } from "@/config/site";
import { eventJsonLd } from "@/libs/seo";
import JsonLd from "@/components/shared/others/JsonLd";
import {
	type CalendarState,
	calendarHref,
	eventStatus,
	eventsInMonth,
	lunarSpan,
	monthGrid,
	eventPath,
	lunarRange,
	solarRange,
	regularEvents,
	monthLabel,
	readCalendarState,
	shiftMonth,
	todayInVietnam,
} from "@/libs/calendar";
import { getContentRepository } from "@/libs/content/repository";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";
import type { ScheduleEvent } from "@/libs/content/types";
import { buddhistYear } from "@/libs/lunar";

const TITLE = "Lịch tu học";

export const metadata: Metadata = {
	title: `${TITLE} – Tùng Lâm Hòa Phúc`,
	description: "Lịch cộng tu, khóa lễ và đại lễ tại Tùng Lâm Hòa Phúc, ghi cả ngày dương và ngày âm lịch.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The schedule (lịch tu học), on the server: ?thang=YYYY-MM picks the month (this month by
// default), ?loai= the type of event. The month in a table with lunar dates, the month's
// theme, then every event of the month as a card, the regular ceremonies, and how to sign up.
export default async function LichTuHoc({ searchParams }: Props) {
	const today = todayInVietnam();
	const asked = readCalendarState(await searchParams, today);
	const schedule = await (await getContentRepository()).getSchedule();

	// The regular ceremonies on their lunar days, for this month and every month ahead, as the old calendar shows them.
	const regular = regularEvents(schedule.programs, asked.month);
	const types = [...new Map([...schedule.events, ...regular].map((event) => [event.category.slug, event.category])).values()].sort((a, b) =>
		a.name.localeCompare(b.name, "vi"),
	);
	const state: CalendarState = { ...asked, type: types.some((type) => type.slug === asked.type) ? asked.type : "" };
	const href = (change: Partial<CalendarState>, hash = "") => calendarHref({ ...state, ...change }, today, hash);

	const monthEvents = eventsInMonth(schedule.events, state.month);
	// The calendar shows the events and the ceremonies; the cards below are the events, the ceremonies have theirs further down.
	const calendarItems = [...monthEvents, ...regular];
	const shownItems = state.type ? calendarItems.filter((event) => event.category.slug === state.type) : calendarItems;
	const shown = shownItems.filter((event) => !event.programId);
	const weeks = monthGrid(state.month, shownItems, today);
	const theme = schedule.themes.find((item) => item.month === Number(state.month.slice(5)));
	const label = monthLabel(state.month);
	const typeName = types.find((type) => type.slug === state.type)?.name;

	// Each card's id, unique even if two events share a slug.
	const anchors = new Map<string, string>();
	for (const event of shownItems) {
		if (event.programId) {
			anchors.set(event.id, `khoa-le-${event.programId}`);
			continue;
		}
		let anchor = `su-kien-${event.slug}`;
		while ([...anchors.values()].includes(anchor)) anchor = `${anchor}-${event.id}`;
		anchors.set(event.id, anchor);
	}
	const firstEventOf = (date: string) => shownItems.find((event) => event.start <= date && event.end >= date) as ScheduleEvent;

	// What the day dialog shows: each item of the month once, and the items of each day.
	const dialogEvents: DialogEvent[] = shownItems.map((event) => ({
		id: event.id,
		title: event.title,
		subtitle: event.subtitle,
		category: event.category,
		solar: solarRange(event),
		lunar: lunarRange(event),
		times: event.times,
		location: event.location,
		description: event.description,
		notes: event.notes,
		image: event.image ? { src: imageAt(event.image.src, IMAGE_WIDTH.card), position: event.image.position } : null,
		icon: EVENT_ICONS[event.category.slug] ?? null,
		href: eventPath(event),
	}));
	const dialogDays = Object.fromEntries(
		weeks
			.flat()
			.filter((day) => day && day.events.length)
			.map((day) => [day!.date, day!.events.map((event) => event.id)]),
	);

	// The nearest month after this one that has events, for an empty month.
	const later = schedule.events.find((event) => event.start.slice(0, 7) > state.month);
	const status = `Tháng ${label}: ${shownItems.length ? `${shownItems.length} sự kiện` : "chưa có sự kiện"}${typeName ? ` loại ${typeName}` : ""}`;

	return (
		<main>
			{monthEvents.map((event) => (
				<JsonLd key={event.id} data={eventJsonLd(event)} />
			))}
			<HeaderSpace />
			<HeroInner title={TITLE} text={TITLE} />

			<section className="section-gap tlhp-calendar" aria-labelledby="lich-thang">
				<div className="container">
					{types.length > 1 ? (
						<nav aria-label="Loại sự kiện">
							<ul className="tlhp-pills">
								<li>
									<Link href={href({ type: "" })} scroll={false} aria-current={!state.type ? "page" : undefined}>
										Tất cả <span className="tlhp-pill-count">{calendarItems.length}</span>
									</Link>
								</li>
								{types.map((type) => (
									<li key={type.slug}>
										<Link href={href({ type: type.slug })} scroll={false} aria-current={type.slug === state.type ? "page" : undefined}>
											{type.name}{" "}
											<span className="tlhp-pill-count">{calendarItems.filter((event) => event.category.slug === type.slug).length}</span>
										</Link>
									</li>
								))}
							</ul>
						</nav>
					) : null}
					<p className="tlhp-list-status" role="status">
						{status}
					</p>

					<DayDialog className="row row-gap-4" events={dialogEvents} days={dialogDays}>
						<div className={theme ? "col-12 col-lg-7" : "col-12"}>
							{/* The calendar in one framed card, as the old site's: the month and its Buddhist year
							    between two round arrows, the weekdays, the days, and what the signs mean.
							    beside the month's poster and verse it stretches to their height. */}
							<div className="tlhp-cal-card">
								<nav className="tlhp-cal-bar" aria-label="Chọn tháng">
									<Link className="tlhp-cal-arrow" href={href({ month: shiftMonth(state.month, -1) })} scroll={false} aria-label={`Tháng ${monthLabel(shiftMonth(state.month, -1))}`}>
										<i className="tji-arrow-left" aria-hidden="true"></i>
									</Link>
									<div className="tlhp-cal-bar-mid">
										<h2 id="lich-thang" className="tlhp-cal-pill">
											Tháng {label}
										</h2>
										<p className="tlhp-cal-pill is-soft tlhp-calendar-lunar">
											{lunarSpan(state.month)} · Phật lịch {buddhistYear(`${state.month}-15`)}
										</p>
										{state.month !== today.slice(0, 7) ? (
											<Link className="tlhp-cal-pill is-link" href={href({ month: today.slice(0, 7) })} scroll={false}>
												Tháng này
											</Link>
										) : null}
									</div>
									<Link className="tlhp-cal-arrow" href={href({ month: shiftMonth(state.month, 1) })} scroll={false} aria-label={`Tháng ${monthLabel(shiftMonth(state.month, 1))}`}>
										<i className="tji-arrow-right" aria-hidden="true"></i>
									</Link>
								</nav>
								<MonthGrid
									weeks={weeks}
									label={label}
									describedBy="lich-ghi-chu"
									hrefFor={(day) => href({}, `#${anchors.get(firstEventOf(day.date).id)}`)}
								/>
								<ul className="tlhp-cal-legend" aria-label="Chú thích">
									<li className="tlhp-cal-legend-title" aria-hidden="true">
										Chú thích
									</li>
									{types.map((type) => (
										<li key={type.slug}>
											{EVENT_ICONS[type.slug] ? <img src={EVENT_ICONS[type.slug]} alt="" width={20} height={20} loading="lazy" decoding="async" /> : <span className="tlhp-day-event-dot" aria-hidden="true" />}
											{type.name}
										</li>
									))}
									<li>
										<span className="tlhp-cal-legend-badge" aria-hidden="true">
											1/10
										</span>
										Mùng 1 và ngày Rằm
									</li>
									<li>
										<span className="tlhp-cal-legend-today" aria-hidden="true"></span>
										Hôm nay
									</li>
								</ul>
								<p id="lich-ghi-chu" className="tlhp-calendar-note">
									Số nhỏ dưới mỗi ngày là ngày âm lịch. Ngày có sự kiện dẫn tới thẻ của sự kiện; danh sách đầy đủ ở ngay dưới lịch.
								</p>
							</div>
						</div>
						{theme ? (
							<div className="col-12 col-lg-5">
								<MonthTheme theme={theme} />
							</div>
						) : null}
					</DayDialog>
				</div>
			</section>

			<section className="tlhp-events" aria-labelledby="su-kien-thang">
				<div className="container">
					<h2 id="su-kien-thang" className="tlhp-section-title">
						Sự kiện tháng {label}
					</h2>
					{shown.length ? (
						<ul className="row row-gap-4 tlhp-event-list">
							{shown.map((event) => (
								<li key={event.id} className="col-12 col-xl-6">
									<EventCard event={event} anchor={anchors.get(event.id)!} status={eventStatus(event, today)} />
								</li>
							))}
						</ul>
					) : (
						<NoItems
							title={`Chưa có lịch ${typeName ? `${typeName} ` : ""}trong tháng ${label}`}
							text={later ? "Kính mời quý vị xem các sự kiện sắp tới." : "Ban Trị Sự sẽ cập nhật lịch sớm."}
							navText={later ? `Xem tháng ${monthLabel(later.start.slice(0, 7))}` : "Về trang chủ"}
							navUrl={later ? href({ month: later.start.slice(0, 7), type: "" }) : "/"}
						/>
					)}
					<LightboxLinks selector=".tlhp-event-video" />
				</div>
			</section>

			{schedule.programs.length ? (
				<section className="section-gap tlhp-programs" aria-labelledby="khoa-le-thuong-ky">
					<div className="container">
						<h2 id="khoa-le-thuong-ky" className="tlhp-section-title">
							Khóa lễ thường kỳ
						</h2>
						<p className="tlhp-section-lead">Các khóa lễ hằng tháng theo ngày âm lịch, kính mời quý Phật tử về tham dự.</p>
						<ul className="row row-gap-4">
							{schedule.programs.map((program) => (
								<li key={program.id} className="col-12 col-md-6 col-xl-4">
									<article id={`khoa-le-${program.id}`} className="blog-item tlhp-post-card tlhp-program" tabIndex={-1}>
										<div className="blog-thumb">
											{program.image ? (
												<img src={imageAt(program.image.src, IMAGE_WIDTH.card)} alt="" width={640} height={360} loading="lazy" decoding="async" style={{ objectPosition: program.image.position }} />
											) : (
												<span className="tlhp-post-card-noimage" />
											)}
										</div>
										<div className="blog-content">
											{program.subtitle ? <span className="tlhp-chip">{program.subtitle}</span> : null}
											<h3 className="title h4">{program.title}</h3>
											{program.summary ? <p className="desc">{program.summary}</p> : null}
											<p className="tlhp-post-card-meta">
												{program.time ? <span>Giờ: {program.time}</span> : null}
												{program.duration ? <span>{program.duration}</span> : null}
												{program.location ? <span>{program.location}</span> : null}
											</p>
										</div>
									</article>
								</li>
							))}
						</ul>
					</div>
				</section>
			) : null}

			<section id="khoa-tu" className="section-gap tlhp-register" aria-labelledby="dang-ky-khoa-tu" tabIndex={-1}>
				<div className="container">
					<div className="row row-gap-4 align-items-center">
						<div className="col-12 col-lg-5">
							<h2 id="dang-ky-khoa-tu" className="tlhp-section-title">
								Đăng ký khóa tu
							</h2>
							<p>
								Trang đăng ký trực tuyến đang được chuẩn bị. Kính mời quý Phật tử gọi Ban lãnh chúng để đăng ký tham dự khóa tu, cộng tu và
								các khóa lễ, hoặc để hỏi thêm về lịch.
							</p>
							<p className="tlhp-register-hours">Giờ đón Phật tử: {site.openingHours}</p>
							<ButtonPrimary text={`Gọi ${formatPhone(site.phone)}`} url={`tel:${site.phone}`} />
						</div>
						<div className="col-12 col-lg-7">
							<ul className="tlhp-register-contacts">
								{site.contacts.map((contact) => (
									<li key={contact.phone}>
										<span className="tlhp-register-role">{contact.role}</span>
										<span className="tlhp-register-name">{contact.name}</span>
										<a href={`tel:${contact.phone}`}>
											<span className="visually-hidden">Gọi {contact.name}: </span>
											{formatPhone(contact.phone)}
										</a>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}
