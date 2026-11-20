import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import PostCard from "@/components/shared/cards/PostCard";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import JsonLd from "@/components/shared/others/JsonLd";
import { DONG_CHAY } from "@/config/sections";
import { site } from "@/config/site";
import { CALENDAR_PATH, calendarHref, eventStatus, findScheduleItem, lunarRange, programDays, solarRange, todayInVietnam } from "@/libs/calendar";
import { IMAGE_WIDTH, imageAt, topImagePriority } from "@/libs/content/media";
import { getContentRepository, slugKey } from "@/libs/content/repository";
import { listHref } from "@/libs/postList";
import { eventJsonLd } from "@/libs/seo";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;
// No pages at build time; each is made on its first visit, then cached (ISR).
export async function generateStaticParams() {
	return [];
}

const SECTION_NAME = "Lịch tu học";
const UPCOMING = 6;
const RELATED = 3;

// The old site's advice for those who come (www/lich-tu-hoc/<khóa lễ>), the same for every event.
const ADVICE = [
	["Trang phục", "Trang nghiêm, kín đáo. Khuyến khích mặc áo tràng lam hoặc áo tràng nâu Phật tử khi bước vào chánh điện."],
	["Thời gian", "Quý vị nên có mặt trước giờ khóa lễ từ 15 đến 30 phút để ổn định vị trí, chuẩn bị tâm thế thanh tịnh."],
	["Tác phong", "Tắt hoặc chuyển điện thoại sang chế độ rung, giữ gìn thanh tịnh và tịnh khẩu nơi tôn nghiêm chốn thiền môn."],
	["Lời dặn", "Quý Phật tử gần xa phát tâm vân tập về Tổ Đình hoặc an tọa tại gia cùng hướng tâm trì tụng kinh chú thanh tịnh."],
];

type Props = { params: Promise<{ slug: string }> };

async function find(slug: string) {
	const schedule = await (await getContentRepository()).getSchedule();
	return findScheduleItem(schedule, slugKey(slug), todayInVietnam());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const found = await find((await params).slug);
	if (!found) return {};
	const title = "event" in found ? found.event.title : found.program.title;
	const description = "event" in found ? found.event.description : found.program.summary;
	return { title: `${title} – ${SECTION_NAME} – ${site.name}`, description: description || undefined };
}

/** "mùng 1 và ngày 15 (rằm)", the lunar days of a regular ceremony in words. */
function lunarDaysText(summary: string): string {
	const { days, last } = programDays(summary);
	const named = days.map((day) => (day === 15 ? "ngày rằm" : day <= 10 ? `mùng ${day}` : `ngày ${day}`));
	if (last) named.push("ngày cuối tháng");
	return `${named.join(" và ")} âm lịch hằng tháng`;
}

// An event of the schedule, or a regular ceremony, on its own page at the old site's address:
// its picture and name, then what one needs to know to come (when, the time, where), what it
// is for, the next days of a ceremony, the advice for those who come, and the reports of the
// same kind of event in Dòng Chảy Hoằng Pháp. The old page drew it all in the browser.
export default async function LichTuHocItem({ params }: Props) {
	const found = await find((await params).slug);
	if (!found) notFound();
	const today = todayInVietnam();
	const event = "event" in found ? found.event : null;
	const program = "program" in found ? found.program : null;
	const upcoming = "upcoming" in found ? found.upcoming : [];
	const title = event?.title ?? program!.title;
	const subtitle = event?.subtitle ?? program!.subtitle;
	const image = event?.image ?? program!.image;
	const description = event?.description ?? program!.summary;
	const category = event?.category ?? upcoming[0]?.category ?? { slug: "khoa-le-truyen-thong", name: "Khóa Lễ Truyền Thống" };
	const back = event ? calendarHref({ month: event.start.slice(0, 7), type: "" }, today, `#su-kien-${event.slug}`) : `${CALENDAR_PATH}#khoa-le-thuong-ky`;
	const status = event ? eventStatus(event, today) : null;
	const related = (await (await getContentRepository()).listPosts({ section: DONG_CHAY.slug, category: category.slug, pageSize: RELATED })).items;

	return (
		<main>
			{event ? <JsonLd data={eventJsonLd(event)} /> : null}
			<HeaderSpace />
			<HeroInner className="tlhp-article-hero" title={title} text={title} breadcrums={[{ name: SECTION_NAME, path: CALENDAR_PATH }]} />
			<article className="section-gap tlhp-article tlhp-event-page">
				<div className="container">
					<div className="row">
						<div className="col-12 col-lg-10 col-xl-9 mx-auto">
							<Link className="tlhp-back-link" href={back}>
								<i className="tji-arrow-left-long" aria-hidden="true"></i> Trở về lịch tu học
							</Link>
							<p className="tlhp-event-chips">
								{status ? <span className={`tlhp-status is-${status.key}`}>{status.label}</span> : null}
								<span className="tlhp-chip">{category.name}</span>
								{subtitle ? <span className="tlhp-event-subtitle">{subtitle}</span> : null}
							</p>

							{image ? (
								<div className="tlhp-article-banner">
									<img
										src={imageAt(image.src, IMAGE_WIDTH.wide)}
										alt=""
										width={1200}
										height={675}
										style={{ objectPosition: image.position }}
										fetchPriority={topImagePriority(imageAt(image.src, IMAGE_WIDTH.wide))}
									/>
								</div>
							) : null}

							<section className="tlhp-article-section" aria-labelledby="thong-tin">
								<h2 id="thong-tin" className="tlhp-article-heading">
									Thông tin thời khóa hành trì
								</h2>
								<dl className="tlhp-event-info">
									<div>
										<dt>Thời gian</dt>
										<dd>
											{event ? (
												<>
													{solarRange(event)}
													<span>Âm lịch {lunarRange(event)}</span>
												</>
											) : (
												<>
													Cố định theo âm lịch
													<span>{lunarDaysText(program!.summary)}</span>
												</>
											)}
										</dd>
									</div>
									<div>
										<dt>Khung giờ</dt>
										<dd>
											{event ? (
												event.times.length ? (
													event.times.map((slot, index) => (
														<span key={index}>
															{slot.label ? `${slot.label}: ` : ""}
															{slot.time || "–"}
														</span>
													))
												) : (
													"Theo thông báo của nhà chùa"
												)
											) : (
												<>
													Bắt đầu {program!.time || "theo thông báo"}
													{program!.duration ? <span>Thời lượng {program!.duration}</span> : null}
												</>
											)}
										</dd>
									</div>
									<div>
										<dt>Địa điểm</dt>
										<dd>
											{(event?.location ?? program!.location) || site.name}
											<span>{site.address}</span>
										</dd>
									</div>
									<div>
										<dt>Đối tượng</dt>
										<dd>
											Đại chúng Phật tử
											<span>Thiện nam tín nữ gần xa</span>
										</dd>
									</div>
								</dl>
							</section>

							{description ? (
								<section className="tlhp-article-section" aria-labelledby="y-nghia">
									<h2 id="y-nghia" className="tlhp-article-heading">
										Ý nghĩa và mục đích hành trì
									</h2>
									<p className="tlhp-article-intro">{description}</p>
								</section>
							) : null}

							{program && upcoming.length ? (
								<section className="tlhp-article-section" aria-labelledby="ngay-sap-toi">
									<h2 id="ngay-sap-toi" className="tlhp-article-heading">
										Các ngày sắp tới
									</h2>
									<ul className="tlhp-event-days">
										{upcoming.slice(0, UPCOMING).map((day) => (
											<li key={day.start}>
												<Link href={calendarHref({ month: day.start.slice(0, 7), type: "" }, today)}>
													<strong>{solarRange(day)}</strong>
													<span>Âm lịch {lunarRange(day)}</span>
												</Link>
											</li>
										))}
									</ul>
								</section>
							) : null}

							<section className="tlhp-article-section" aria-labelledby="luu-y">
								<h2 id="luu-y" className="tlhp-article-heading">
									Lưu ý dành cho Phật tử khi tham dự
								</h2>
								{event?.notes ? (
									<p className="tlhp-event-notes">
										<strong>Lưu ý hành trì:</strong> {event.notes}
									</p>
								) : null}
								<ul className="tlhp-event-advice">
									{ADVICE.map(([label, text]) => (
										<li key={label}>
											<strong>{label}:</strong> {text}
										</li>
									))}
								</ul>
							</section>
						</div>
					</div>

					{related.length ? (
						<section className="tlhp-article-section tlhp-related" aria-labelledby="ky-su">
							<h2 id="ky-su" className="tlhp-article-heading">
								Ký sự và hình ảnh {category.name.toLocaleLowerCase("vi")}
							</h2>
							<ul className="row row-gap-4 tlhp-post-grid">
								{related.map((post) => (
									<li key={post.id} className="col-12 col-md-6 col-xl-4">
										<PostCard post={post} href={`${DONG_CHAY.path}/${post.slug}`} categoryHref={listHref(DONG_CHAY.path, { category: post.category.slug, sort: "moi-nhat", page: 1 })} />
									</li>
								))}
							</ul>
						</section>
					) : null}
				</div>
			</article>
			<Cta />
		</main>
	);
}
