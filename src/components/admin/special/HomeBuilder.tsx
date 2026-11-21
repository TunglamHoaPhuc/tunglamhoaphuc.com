"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader } from "../media/imageTools";
import { Alert, Badge, Button, EmptyState, errorText, fieldErrors, Loading, PageHeader, SelectField, TextArea, TextField } from "../ui";
import { Feedback, moved, MoveButtons, PictureField, PositionSelect, type Picture } from "./kit";

type BlockState = { block: string; key: string; label: string; live: unknown; draft: unknown; hasDraft: boolean };
type HomeData = {
	blocks: BlockState[];
	media: Record<string, string>;
	defaults: { hero: { title: string; subtitle: string; text: string; ctaLabel: string; ctaHref: string }; stats: { label: string; source: string; value: number }[]; buddhist_year: { mode: string; value: number }; quotes: { source: string; mode: string } };
	featuredAreas: { id: string; name: string; coverUrl: string }[];
};

type Slide = { id: string; enabled: boolean; title: string; subtitle: string; text: string; imageMediaId: string | null; portraitMediaId: string | null; imagePosition: string; ctaLabel: string; ctaHref: string };
type Hero = { slides: Slide[]; autoEvent: boolean; autoLatest: boolean };
type Welcome = { quote: string; author: string; paragraph: string; imageMediaId: string | null; videoUrl: string; linkLabel: string; linkHref: string };
type Stat = { label: string; source: string; value: number };
type Year = { mode: string; value: number };
type QuotesSetting = { source: string; mode: string };

const asObject = <T,>(value: unknown, fallback: T): T => (value && typeof value === "object" ? ({ ...fallback, ...(value as object) } as T) : fallback);

/** The panel of one block: status, the form (children), a text preview, and Lưu nháp / Xuất bản / Bỏ nháp. */
function BlockPanel({ state, value, preview, children, errors, onErrors, onSaved }: { state: BlockState; value: () => unknown; preview: ReactNode; children: ReactNode; errors: Record<string, string>; onErrors: (fields: Record<string, string>) => void; onSaved: () => void }) {
	const { can } = useAdmin();
	const [busy, setBusy] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const canEdit = can("home", "update");
	const canPublish = can("home", "publish");
	async function run(key: string, action: () => Promise<unknown>, message: string) {
		setBusy(key);
		setError("");
		setNotice("");
		onErrors({});
		try {
			await action();
			setNotice(message);
			onSaved();
		} catch (caught) {
			setError(errorText(caught));
			onErrors(fieldErrors(caught));
		} finally {
			setBusy("");
		}
	}
	const send = (publish: boolean) => api("PUT", `home/${state.block}`, { value: value(), publish });
	return (
		<section className="tq-panel" aria-labelledby={`hb-${state.block}`}>
			<h2 className="tq-h2" id={`hb-${state.block}`}>
				{state.label}{" "}
				{state.hasDraft ? <Badge tone="warn">Có bản nháp chưa xuất bản</Badge> : state.live ? <Badge tone="ok">Đã xuất bản</Badge> : <Badge>Đang dùng nội dung mặc định của trang</Badge>}
			</h2>
			<Feedback error={error || (Object.keys(errors).length ? "Có mục chưa hợp lệ, xem các dòng báo lỗi bên dưới." : "")} notice={notice} />
			{children}
			<div className="tq-panel" style={{ background: "var(--tq-line-soft)" }} aria-label="Xem trước chữ">
				<strong>Xem trước (chỉ phần chữ)</strong>
				<div style={{ marginTop: 8 }}>{preview}</div>
			</div>
			<div className="tq-actions">
				{canEdit ? (
					<Button variant="secondary" busy={busy === "draft"} onClick={() => void run("draft", () => send(false), "Đã lưu bản nháp. Trang công khai chưa đổi.")}>
						Lưu bản nháp
					</Button>
				) : null}
				{canPublish ? (
					<Button busy={busy === "publish"} onClick={() => void run("publish", () => send(true), "Đã xuất bản. Trang chủ sẽ đổi trong vòng vài phút.")}>
						Xuất bản
					</Button>
				) : null}
				{canEdit && state.hasDraft ? (
					<Button variant="secondary" busy={busy === "discard"} onClick={() => void run("discard", () => api("DELETE", `home/${state.block}/draft`), "Đã bỏ bản nháp. Biểu mẫu trở về bản đang xuất bản sau khi tải lại.")}>
						Bỏ bản nháp
					</Button>
				) : null}
			</div>
			{canPublish ? null : <p className="tq-hint">Bạn lưu được bản nháp; người có quyền xuất bản sẽ đăng lên trang.</p>}
		</section>
	);
}

// ------------------------------------------------------------------ hero

function HeroBlock({ state, data, reload }: { state: BlockState; data: HomeData; reload: () => void }) {
	const start = asObject<Hero>(state.draft ?? state.live, { slides: [], autoEvent: true, autoLatest: true });
	const [hero, setHero] = useState<Hero>({ ...start, slides: start.slides.map((slide) => ({ ...slide })) });
	const [errors, setErrors] = useState<Record<string, string>>({});
	const media = (id: string | null): Picture | null => (id ? { id, url: data.media[id] ?? "" } : null);
	const [pics, setPics] = useState<Record<string, string>>({});
	const edit = (index: number, patch: Partial<Slide>) => setHero((current) => ({ ...current, slides: current.slides.map((slide, at) => (at === index ? { ...slide, ...patch } : slide)) }));
	const add = () =>
		setHero((current) => ({
			...current,
			slides: [...current.slides, { id: `k${Date.now().toString(36)}`, enabled: true, title: data.defaults.hero.title, subtitle: data.defaults.hero.subtitle, text: data.defaults.hero.text, imageMediaId: null, portraitMediaId: null, imagePosition: "center 50%", ctaLabel: data.defaults.hero.ctaLabel, ctaHref: data.defaults.hero.ctaHref }],
		}));
	return (
		<BlockPanel
			state={state}
			value={() => hero}
			errors={errors}
			onErrors={setErrors}
			onSaved={reload}
			preview={
				<ol>
					{hero.slides.map((slide) => (
						<li key={slide.id}>
							{slide.enabled ? "" : "(đang tắt) "}
							<strong>{slide.title || "(chưa có tiêu đề)"}</strong>
							{slide.subtitle ? ` — ${slide.subtitle}` : ""}
							{slide.text ? <div className="tq-muted">{slide.text}</div> : null}
							{slide.ctaLabel ? <div>Nút: “{slide.ctaLabel}” → {slide.ctaHref || "(trang mặc định)"}</div> : null}
						</li>
					))}
					{hero.slides.length === 0 ? <li>Chưa có khung riêng: trang dùng khung mặc định “{data.defaults.hero.title}”.</li> : null}
					{hero.autoEvent ? <li>Tự thêm khung sự kiện kế tiếp</li> : null}
					{hero.autoLatest ? <li>Tự thêm khung bài mới nhất</li> : null}
				</ol>
			}
		>
			{errors.slides ? <p className="tq-field-error">{errors.slides}</p> : null}
			{hero.slides.length === 0 ? <EmptyState>Chưa có khung riêng nào. Trang chủ đang dùng khung mặc định.</EmptyState> : null}
			<ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
				{hero.slides.map((slide, index) => {
					const err = (field: string) => errors[`slides.${index}.${field}`];
					return (
						<li key={slide.id} className="tq-panel" style={{ margin: 0 }}>
							<label className="tq-check">
								<input type="checkbox" checked={slide.enabled} onChange={(e) => edit(index, { enabled: e.target.checked })} />
								<span>Khung {index + 1} đang bật</span>
							</label>
							<TextField label="Tiêu đề" value={slide.title} onChange={(e) => edit(index, { title: e.target.value })} error={err("title")} maxLength={120} />
							<TextField label="Tiêu đề phụ" value={slide.subtitle} onChange={(e) => edit(index, { subtitle: e.target.value })} error={err("subtitle")} maxLength={120} />
							<TextArea label="Mô tả" value={slide.text} onChange={(e) => edit(index, { text: e.target.value })} error={err("text")} />
							<PictureField label="Ảnh nền (màn hình ngang)" value={pics[`${slide.id}-i`] !== undefined && slide.imageMediaId ? { id: slide.imageMediaId, url: pics[`${slide.id}-i`] } : media(slide.imageMediaId)} onChange={(p) => { setPics((c) => ({ ...c, [`${slide.id}-i`]: p?.url ?? "" })); edit(index, { imageMediaId: p?.id ?? null }); }} error={err("imageMediaId")} />
							<PictureField label="Ảnh nền (điện thoại cầm dọc)" value={pics[`${slide.id}-p`] !== undefined && slide.portraitMediaId ? { id: slide.portraitMediaId, url: pics[`${slide.id}-p`] } : media(slide.portraitMediaId)} onChange={(p) => { setPics((c) => ({ ...c, [`${slide.id}-p`]: p?.url ?? "" })); edit(index, { portraitMediaId: p?.id ?? null }); }} error={err("portraitMediaId")} />
							<PositionSelect value={slide.imagePosition} onChange={(value) => edit(index, { imagePosition: value })} />
							<div className="tq-toolbar">
								<TextField label="Chữ trên nút" value={slide.ctaLabel} onChange={(e) => edit(index, { ctaLabel: e.target.value })} error={err("ctaLabel")} maxLength={40} />
								<TextField label="Đường dẫn của nút" value={slide.ctaHref} onChange={(e) => edit(index, { ctaHref: e.target.value })} error={err("ctaHref")} hint="Bắt đầu bằng / hoặc https://" />
							</div>
							<div className="tq-actions">
								<MoveButtons index={index} length={hero.slides.length} label={`khung ${index + 1}`} onMove={(to) => setHero({ ...hero, slides: moved(hero.slides, index, to) })} />
								<Button variant="secondary" onClick={() => setHero({ ...hero, slides: hero.slides.filter((_, at) => at !== index) })}>
									Bỏ khung
								</Button>
							</div>
						</li>
					);
				})}
			</ol>
			<Button variant="secondary" disabled={hero.slides.length >= 8} onClick={add}>
				Thêm khung
			</Button>
			<label className="tq-check" style={{ marginTop: 12 }}>
				<input type="checkbox" checked={hero.autoEvent} onChange={(e) => setHero({ ...hero, autoEvent: e.target.checked })} />
				<span>Tự thêm khung sự kiện kế tiếp</span>
			</label>
			<label className="tq-check">
				<input type="checkbox" checked={hero.autoLatest} onChange={(e) => setHero({ ...hero, autoLatest: e.target.checked })} />
				<span>Tự thêm khung bài viết mới nhất</span>
			</label>
		</BlockPanel>
	);
}

// ------------------------------------------------------------------ welcome

function WelcomeBlock({ state, data, reload }: { state: BlockState; data: HomeData; reload: () => void }) {
	const start = asObject<Welcome>(state.draft ?? state.live, { quote: "", author: "", paragraph: "", imageMediaId: null, videoUrl: "", linkLabel: "", linkHref: "" });
	const [w, setW] = useState<Welcome>(start);
	const [url, setUrl] = useState(start.imageMediaId ? (data.media[start.imageMediaId] ?? "") : "");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const set = (patch: Partial<Welcome>) => setW((current) => ({ ...current, ...patch }));
	return (
		<BlockPanel
			state={state}
			value={() => w}
			errors={errors}
			onErrors={setErrors}
			onSaved={reload}
			preview={
				<>
					<p>
						<strong>{w.quote || "(dùng lời trích mặc định của trang Lịch sử Bổn tự)"}</strong>
						{w.author ? ` — ${w.author}` : ""}
					</p>
					{w.paragraph ? <p>{w.paragraph}</p> : null}
					{w.linkLabel ? <p>Liên kết: “{w.linkLabel}” → {w.linkHref || "(mặc định)"}</p> : null}
				</>
			}
		>
			<p className="tq-hint">Ô nào để trống thì trang giữ nội dung mặc định lấy từ trang “Lịch sử Bổn tự”.</p>
			<TextArea label="Lời trích" rows={2} value={w.quote} onChange={(e) => set({ quote: e.target.value })} error={errors.quote} />
			<TextField label="Tác giả" value={w.author} onChange={(e) => set({ author: e.target.value })} error={errors.author} maxLength={120} />
			<TextArea label="Đoạn văn" rows={4} value={w.paragraph} onChange={(e) => set({ paragraph: e.target.value })} error={errors.paragraph} />
			<PictureField label="Ảnh" value={w.imageMediaId ? { id: w.imageMediaId, url } : null} onChange={(p) => { setUrl(p?.url ?? ""); set({ imageMediaId: p?.id ?? null }); }} error={errors.imageMediaId} />
			<TextField label="Video YouTube" type="url" value={w.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} error={errors.videoUrl} hint="Chỉ nhận đường dẫn YouTube." />
			<div className="tq-toolbar">
				<TextField label="Chữ trên liên kết" value={w.linkLabel} onChange={(e) => set({ linkLabel: e.target.value })} error={errors.linkLabel} maxLength={40} />
				<TextField label="Đường dẫn liên kết" value={w.linkHref} onChange={(e) => set({ linkHref: e.target.value })} error={errors.linkHref} hint="Bắt đầu bằng / hoặc https://" />
			</div>
		</BlockPanel>
	);
}

// ------------------------------------------------------------------ stats, year, quotes

const SOURCES: [string, string][] = [
	["auto-bai-dong-chay", "Tự đếm bài Dòng Chảy Hoằng Pháp"],
	["auto-bai-tri-tue", "Tự đếm bài Trí Tuệ Phật Pháp"],
	["auto-phat-lich", "Năm Phật lịch"],
	["manual", "Nhập tay"],
];

function StatsBlock({ state, data, reload }: { state: BlockState; data: HomeData; reload: () => void }) {
	const start = (Array.isArray(state.draft ?? state.live) ? (state.draft ?? state.live) : data.defaults.stats) as Stat[];
	const [stats, setStats] = useState<Stat[]>(start.map((item) => ({ ...item })));
	const [errors, setErrors] = useState<Record<string, string>>({});
	const edit = (index: number, patch: Partial<Stat>) => setStats((current) => current.map((item, at) => (at === index ? { ...item, ...patch } : item)));
	return (
		<BlockPanel
			state={state}
			value={() => stats.map((item) => ({ ...item, value: Number(item.value) || 0 }))}
			errors={errors}
			onErrors={setErrors}
			onSaved={reload}
			preview={
				<ul>
					{stats.map((item, index) => (
						<li key={index}>
							{item.label || "(chưa có nhãn)"}: {item.source === "manual" ? item.value : (SOURCES.find(([key]) => key === item.source)?.[1] ?? "")}
						</li>
					))}
				</ul>
			}
		>
			{errors._ ? <p className="tq-field-error">{errors._}</p> : null}
			{stats.map((item, index) => (
				<div className="tq-toolbar" key={index}>
					<TextField label={`Nhãn số liệu ${index + 1}`} value={item.label} onChange={(e) => edit(index, { label: e.target.value })} error={errors[`${index}.label`]} maxLength={80} />
					<SelectField label="Nguồn" value={item.source} onChange={(e) => edit(index, { source: e.target.value })} error={errors[`${index}.source`]}>
						{SOURCES.map(([key, name]) => (
							<option key={key} value={key}>
								{name}
							</option>
						))}
					</SelectField>
					{item.source === "manual" ? <TextField label="Giá trị" type="number" min={0} value={String(item.value)} onChange={(e) => edit(index, { value: Number(e.target.value) })} error={errors[`${index}.value`]} /> : null}
					<Button variant="secondary" onClick={() => setStats(stats.filter((_, at) => at !== index))} aria-label={`Bỏ số liệu ${index + 1}`}>
						Bỏ
					</Button>
				</div>
			))}
			<Button variant="secondary" disabled={stats.length >= 3} onClick={() => setStats([...stats, { label: "", source: "manual", value: 0 }])}>
				Thêm số liệu
			</Button>
		</BlockPanel>
	);
}

function YearBlock({ state, data, reload }: { state: BlockState; data: HomeData; reload: () => void }) {
	const [year, setYear] = useState<Year>(asObject<Year>(state.draft ?? state.live, data.defaults.buddhist_year));
	const [errors, setErrors] = useState<Record<string, string>>({});
	return (
		<BlockPanel state={state} value={() => ({ mode: year.mode, value: Number(year.value) || 1 })} errors={errors} onErrors={setErrors} onSaved={reload} preview={<p>{year.mode === "auto" ? "Phật lịch tự tính theo ngày hôm nay." : `Phật lịch ${year.value} (nhập tay).`}</p>}>
			<SelectField label="Cách tính Phật lịch" value={year.mode} onChange={(e) => setYear({ ...year, mode: e.target.value })} error={errors.mode}>
				<option value="auto">Tự tính</option>
				<option value="manual">Nhập tay</option>
			</SelectField>
			{year.mode === "manual" ? <TextField label="Năm Phật lịch" type="number" min={1} max={9999} value={String(year.value)} onChange={(e) => setYear({ ...year, value: Number(e.target.value) })} error={errors.value} /> : null}
		</BlockPanel>
	);
}

function QuotesBlock({ state, data, reload }: { state: BlockState; data: HomeData; reload: () => void }) {
	const [q, setQ] = useState<QuotesSetting>(asObject<QuotesSetting>(state.draft ?? state.live, data.defaults.quotes));
	const [errors, setErrors] = useState<Record<string, string>>({});
	return (
		<BlockPanel
			state={state}
			value={() => q}
			errors={errors}
			onErrors={setErrors}
			onSaved={reload}
			preview={<p>{q.source === "trich-dan" ? `Hiện các lời dạy đang bật ${q.mode === "ngau-nhien" ? "theo thứ tự ngẫu nhiên mỗi lượt xem" : "theo đúng thứ tự"}.` : "Hiện câu kệ của chủ đề từng tháng."}</p>}
		>
			<SelectField label="Nguồn của khối “Lời Thầy dạy”" value={q.source} onChange={(e) => setQ({ ...q, source: e.target.value })} error={errors.source}>
				<option value="chu-de-thang">Câu kệ của chủ đề từng tháng</option>
				<option value="trich-dan">Các lời dạy nhập riêng</option>
			</SelectField>
			{q.source === "trich-dan" ? (
				<SelectField label="Thứ tự hiện" value={q.mode} onChange={(e) => setQ({ ...q, mode: e.target.value })} error={errors.mode} hint="Ngẫu nhiên: xáo trộn mỗi lần mở trang.">
					<option value="thu-tu">Theo thứ tự</option>
					<option value="ngau-nhien">Ngẫu nhiên</option>
				</SelectField>
			) : null}
			<p className="tq-hint">
				Soạn các lời dạy tại <Link href="/quan-tri/loi-thay-day">Lời Thầy dạy</Link>.
			</p>
		</BlockPanel>
	);
}

export function HomeBuilder() {
	const loaded = useLoader(() => api<HomeData>("GET", "home"), "home-builder");
	const [version, setVersion] = useState(0);
	const data = loaded.data;
	const refresh = () => {
		loaded.reload();
		setVersion((n) => n + 1);
	};
	const state = (name: string) => data?.blocks.find((block) => block.block === name);
	return (
		<>
			<PageHeader title="Trang chủ" />
			<p className="tq-muted">Mỗi khối có bản nháp riêng. Chỉ khi bấm “Xuất bản” thì trang công khai mới đổi.</p>
			{loaded.error ? (
				<>
					<Alert kind="error">{loaded.error}</Alert>
					<Button variant="secondary" onClick={loaded.reload}>
						Thử lại
					</Button>
				</>
			) : !data ? (
				<Loading />
			) : (
				<>
					{/* Each block is re-made after a save so its form shows what the server now holds. */}
					<HeroBlock key={`hero-${version}`} state={state("hero")!} data={data} reload={refresh} />
					<WelcomeBlock key={`welcome-${version}`} state={state("welcome")!} data={data} reload={refresh} />
					<StatsBlock key={`stats-${version}`} state={state("stats")!} data={data} reload={refresh} />
					<YearBlock key={`year-${version}`} state={state("buddhist_year")!} data={data} reload={refresh} />
					<QuotesBlock key={`quotes-${version}`} state={state("quotes")!} data={data} reload={refresh} />
					<section className="tq-panel" aria-labelledby="hb-areas">
						<h2 className="tq-h2" id="hb-areas">
							Khu vực nổi bật
						</h2>
						{data.featuredAreas.length === 0 ? <EmptyState>Chưa chọn khu vực nổi bật nào.</EmptyState> : <ol>{data.featuredAreas.map((area) => <li key={area.id}>{area.name}</li>)}</ol>}
						<p className="tq-hint">
							Chọn và sắp xếp tại <Link href="/quan-tri/khu-vuc">Khu vực</Link>.
						</p>
					</section>
				</>
			)}
		</>
	);
}
