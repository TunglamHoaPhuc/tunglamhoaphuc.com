"use client";

// The edit screen of a post, a Tông Chỉ article or a Giới thiệu page: title and slug, the summary, the TipTap body,
// and beside it the status (with a schedule typed in Vietnam time), the category, pictures, SEO, the category's own
// fields, related things and the history. Ctrl+S saves; a save never rebuilds the form or the editor (what was typed while
// it was on its way stays, with the focus and the undo history); leaving with unsaved changes asks first, in the page
// (useLeaveGuard); a save that lost the race to another editor (409) offers to load the newest version.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";
import { api, ApiClientError } from "../api";
import { useAdmin } from "../AdminProvider";
import { MediaPicker } from "../media/MediaPicker";
import { useLoader } from "../media/imageTools";
import { Alert, Badge, Button, errorText, fieldErrors, Loading, PageHeader, SelectField, TextArea, TextField, when } from "../ui";
import { LeaveNotice, useLeaveGuard } from "../useLeaveGuard";
import { advanceBaseline, bodyIsDirty, errorAt, normalizeYoutubeUrl, orphanErrors, publishMessage, rebase, same, SLUG_FROM_TITLE_MAX, slugify, slugOnBlur, tidyVideo, videoFormOf, videoPayload, youtubeId } from "./editorLogic";
import { ExtraFields, MediaField, MilestonesEditor, RelatedPanel, RevisionPanel } from "./parts";
import { RichEditor, type EditorValue } from "./RichEditor";
import { isoToVietnamInput, vietnamInputToIso, vietnamToday } from "./time";
import { KIND_UI, STATUS_LABELS, STATUS_TONES, type ContentDetail, type KindName, type MediaPreview, type Milestone, type Options } from "./types";

type Form = Record<string, unknown>;

const COMMON = ["title", "subtitle", "slug", "categoryId", "bannerMediaId", "bannerPosition", "seoTitle", "seoDescription", "ogMediaId"];
const EDIT_KEYS: Record<KindName, string[]> = {
	posts: [...COMMON, "section", "author", "publishedDate", "thumbnailMediaId", "thumbnailPosition", "summary", "intro", "pinned", "extra"],
	teachings: [...COMMON, "name", "excerpt", "author", "authorHref", "publishedDate", "video", "book", "position"],
	pages: [...COMMON, "kicker", "portraitMediaId", "portraitPosition", "overview", "quote", "book", "position", "milestones"],
};

const str = (value: unknown) => (typeof value === "string" ? value : "");

/** The form of a saved article: the keys the editor edits, with the video of a Tông Chỉ article reduced to what the form holds. */
function formOf(kind: KindName, data: ContentDetail): Form {
	const form: Form = Object.fromEntries(EDIT_KEYS[kind].map((key) => [key, data[key] ?? null]));
	if (kind === "teachings") form.video = videoFormOf(form.video);
	return form;
}

/** Paths of the inputs that show a server error beside them; an error anywhere else goes to a block of its own. */
const SHOWN_ERRORS: Record<KindName, string[]> = {
	posts: ["title", "subtitle", "slug", "summary", "intro", "section", "categoryId", "publishedDate", "author", "thumbnailMediaId", "bannerMediaId", "ogMediaId", "seoTitle", "seoDescription", "extra", "publishAt", "contentHtml", "contentJson"],
	teachings: ["title", "subtitle", "slug", "name", "excerpt", "categoryId", "publishedDate", "author", "authorHref", "position", "bannerMediaId", "ogMediaId", "seoTitle", "seoDescription", "video", "book", "publishAt", "contentHtml", "contentJson"],
	pages: ["title", "subtitle", "slug", "overview", "categoryId", "kicker", "position", "bannerMediaId", "portraitMediaId", "ogMediaId", "seoTitle", "seoDescription", "quote", "book", "milestones", "publishAt", "contentHtml", "contentJson"],
};

function blankForm(kind: KindName): Form {
	const form: Form = { title: "", subtitle: "", slug: "", categoryId: null, bannerMediaId: null, bannerPosition: "center 50%", seoTitle: "", seoDescription: "", ogMediaId: null };
	if (kind === "posts") Object.assign(form, { section: "dong-chay-hoang-phap", author: "", publishedDate: vietnamToday(), thumbnailMediaId: null, thumbnailPosition: "center 50%", summary: "", intro: "", pinned: false, extra: {} });
	if (kind === "teachings") Object.assign(form, { name: "", excerpt: "", author: "", authorHref: null, publishedDate: vietnamToday(), video: null, book: null, position: 0 });
	if (kind === "pages") Object.assign(form, { kicker: "", portraitMediaId: null, portraitPosition: "center 50%", overview: "", quote: null, book: null, position: 0, milestones: [] });
	return form;
}

/** Empty objects of the optional blocks become null, the way the server keeps "none". */
function tidy(kind: KindName, form: Form): Form {
	const out = { ...form };
	const empty = (value: unknown, keys: string[]) => !value || keys.every((key) => !str((value as Form)[key]).trim());
	if (kind === "teachings") out.video = tidyVideo(out.video);
	if (kind !== "posts" && empty(out.book, ["title"])) out.book = null;
	if (kind === "pages" && out.quote && !str((out.quote as Form).title).trim() && !((out.quote as { lines?: string[] }).lines ?? []).some((line) => line.trim())) out.quote = null;
	for (const key of ["seoTitle", "seoDescription"]) if (out[key] === "") out[key] = null;
	return out;
}

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
	return (
		<section className="tq-panel" aria-labelledby={id}>
			<h2 id={id} className="tq-h2">
				{title}
			</h2>
			{children}
		</section>
	);
}

export function ContentEditor({ kind, id }: { kind: KindName; id: string | null }) {
	const ui = KIND_UI[kind];
	const { can } = useAdmin();
	const router = useRouter();
	const options = useLoader(() => api<Options>("GET", `${kind}/options`), `${kind}-options`);
	const [detail, setDetail] = useState<ContentDetail | null>(null);
	const [loadError, setLoadError] = useState("");
	const [form, setForm] = useState<Form>(() => blankForm(kind));
	// What the form is compared with: the state as last loaded or saved.
	const [baseline, setBaseline] = useState<Form>(() => blankForm(kind));
	// The body as the editor last produced it (null until the person types), and the HTML last saved from it.
	const [body, setBody] = useState<EditorValue | null>(null);
	const [savedBody, setSavedBody] = useState<string | null>(null);
	const bodyRef = useRef<EditorValue | null>(null);
	const [editorKey, setEditorKey] = useState(0);
	const [editorSeed, setEditorSeed] = useState<JSONContent | string>("");
	const [sanitized, setSanitized] = useState<"" | "reloaded" | "kept">("");
	const [media, setMedia] = useState<Record<string, MediaPreview>>({});
	const [slugTyped, setSlugTyped] = useState(false);
	const [slugTouched, setSlugTouched] = useState(id !== null);
	const [slugNote, setSlugNote] = useState<{ kind: "success" | "warning"; text: string } | null>(null);
	const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [notice, setNotice] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);
	const [fields, setFields] = useState<Record<string, string>>({});
	const [conflict, setConflict] = useState(false);
	const [schedule, setSchedule] = useState("");
	const [confirmDelete, setConfirmDelete] = useState(false);

	/** The editor is rebuilt (its content, undo history and caret start again) only here: on loading, restoring, loading the newest and when the server cleaned the body. */
	const remountEditor = useCallback((data: ContentDetail, fromStoredHtml: boolean) => {
		setEditorSeed(fromStoredHtml ? data.contentHtml || "" : (data.contentJson ?? data.contentHtml ?? ""));
		setEditorKey((n) => n + 1);
		bodyRef.current = null;
		setBody(null);
		setSavedBody(null);
	}, []);

	const apply = useCallback(
		(data: ContentDetail) => {
			const loaded = formOf(kind, data);
			setDetail(data);
			setForm(loaded);
			setBaseline(loaded);
			setMedia(data.media ?? {});
			remountEditor(data, false);
			setSchedule(isoToVietnamInput(data.publishAt));
			setConflict(false);
			setFields({});
			setSanitized("");
			setSlugSuggestion(null);
			setSlugNote(null);
			setSlugTyped(false);
		},
		[kind, remountEditor],
	);

	const load = useCallback(async () => {
		if (!id) return;
		setLoadError("");
		try {
			apply(await api<ContentDetail>("GET", `${kind}/${encodeURIComponent(id)}`));
		} catch (error) {
			setLoadError(errorText(error));
		}
	}, [apply, id, kind]);

	useEffect(() => {
		// Loads the article once per id; the state is set when the request answers.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		void load();
	}, [load]);

	const changedKeys = EDIT_KEYS[kind].filter((key) => !same(tidy(kind, form)[key], tidy(kind, baseline)[key]));
	const dirty = changedKeys.length > 0 || bodyIsDirty(body, savedBody);
	const editable = !detail || detail.canUpdate;
	const guard = useLeaveGuard(dirty && editable);

	const set = (key: string, value: unknown) => {
		setForm((now) => {
			const next = { ...now, [key]: value };
			if (key === "title" && !slugTouched) next.slug = slugify(String(value), SLUG_FROM_TITLE_MAX);
			return next;
		});
		setNotice(null);
	};
	const sub = (key: string, inner: string, value: unknown) => set(key, { ...((form[key] as Form | null) ?? {}), [inner]: value });
	const rememberMedia = (preview: MediaPreview | null) => preview && setMedia((now) => ({ ...now, [preview.id]: preview }));

	/** A save or a status change answered with the stored article: the article, its version and rights are taken, the typing is left alone. */
	const adopt = (data: ContentDetail) => {
		setDetail(data);
		setMedia((now) => ({ ...now, ...(data.media ?? {}) }));
		setConflict(false);
	};

	const save = useCallback(async () => {
		if (saving || !editable) return;
		setSaving(true);
		setNotice(null);
		setFields({});
		setSlugSuggestion(null);
		try {
			const clean = tidy(kind, form);
			const sentBody = bodyIsDirty(body, savedBody) ? body : null;
			if (!detail) {
				const payload: Form = {};
				for (const [key, value] of Object.entries(clean)) if (value !== "" && value !== null) payload[key] = value;
				if (sentBody) Object.assign(payload, { contentHtml: sentBody.html, contentJson: sentBody.json });
				const created = await api<ContentDetail>("POST", kind, payload);
				router.replace(`/quan-tri/${ui.path}/${encodeURIComponent(created.id)}`);
				return;
			}
			const payload: Form = { version: detail.version };
			for (const key of changedKeys) payload[key] = kind === "teachings" && key === "video" ? videoPayload(clean.video) : clean[key];
			if (sentBody) Object.assign(payload, { contentHtml: sentBody.html, contentJson: sentBody.json });
			if (Object.keys(payload).length === 1) {
				setNotice({ kind: "success", text: "Không có thay đổi để lưu." });
				return;
			}
			const saved = await api<ContentDetail & { bodyChanged?: boolean }>("PATCH", `${kind}/${encodeURIComponent(detail.id)}`, payload);
			adopt(saved);
			setBaseline((now) => advanceBaseline(now, clean, changedKeys));
			if (sentBody) setSavedBody(sentBody.html);
			if (saved.bodyChanged) {
				// The server cleaned the body, so the editor shows what is stored. Unless more was typed meanwhile: that stays, and the next save cleans it again.
				const typedMeanwhile = bodyRef.current !== null && sentBody !== null && bodyRef.current.html !== sentBody.html;
				if (typedMeanwhile) setSanitized("kept");
				else {
					remountEditor(saved, true);
					setSanitized("reloaded");
				}
			} else setSanitized("");
			setNotice({ kind: "success", text: `Đã lưu (phiên bản ${saved.version}).` });
		} catch (error) {
			if (error instanceof ApiClientError && error.code === "conflict") setConflict(true);
			if (error instanceof ApiClientError && error.code === "slug_taken") setSlugSuggestion(error.suggestedSlug);
			setFields(fieldErrors(error));
			setNotice({ kind: "error", text: errorText(error) });
		} finally {
			setSaving(false);
		}
	}, [body, changedKeys, detail, editable, form, kind, remountEditor, router, saving, savedBody, ui.path]);

	// Ctrl+S / Cmd+S saves, wherever the focus is.
	const saveRef = useRef(save);
	useEffect(() => {
		saveRef.current = save;
	});
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				void saveRef.current();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	async function act(path: string, payload: Form, done: string | ((next: ContentDetail) => string)) {
		if (!detail) return;
		setSaving(true);
		setNotice(null);
		setFields({});
		try {
			const next = await api<ContentDetail>("POST", `${kind}/${encodeURIComponent(detail.id)}/${path}`, { version: detail.version, ...payload });
			adopt(next);
			// A status change can set fields of its own (the first publication date): what was not touched follows, what was typed stays.
			const stored = formOf(kind, next);
			setForm((now) => rebase(baseline, stored, now));
			setBaseline(stored);
			setSchedule(isoToVietnamInput(next.publishAt));
			setNotice({ kind: "success", text: typeof done === "function" ? done(next) : done });
		} catch (error) {
			if (error instanceof ApiClientError && error.code === "conflict") setConflict(true);
			setFields(fieldErrors(error));
			setNotice({ kind: "error", text: errorText(error) });
		} finally {
			setSaving(false);
		}
	}

	async function preview() {
		if (!detail) return;
		// Opened at once (inside the click) so the browser does not block it; its address follows.
		const tab = window.open("about:blank", "_blank");
		try {
			const link = await api<{ url: string; expiresAt: string }>("POST", `${kind}/${encodeURIComponent(detail.id)}/preview-token`, {});
			if (tab) {
				tab.opener = null;
				tab.location.href = link.url;
			} else window.location.assign(link.url);
			setNotice({ kind: "success", text: `Đã mở bản xem trước; liên kết dùng được tới ${when(link.expiresAt)}.` });
		} catch (error) {
			tab?.close();
			setNotice({ kind: "error", text: errorText(error) });
		}
	}

	async function duplicate() {
		if (!detail) return;
		try {
			const copy = await api<ContentDetail>("POST", `${kind}/${encodeURIComponent(detail.id)}/duplicate`, {});
			router.push(`/quan-tri/${ui.path}/${encodeURIComponent(copy.id)}`);
		} catch (error) {
			setNotice({ kind: "error", text: errorText(error) });
		}
	}

	async function remove() {
		if (!detail) return;
		try {
			await api("DELETE", `${kind}/${encodeURIComponent(detail.id)}`);
			router.push(`/quan-tri/${ui.path}`);
		} catch (error) {
			setNotice({ kind: "error", text: errorText(error) });
		}
	}

	async function checkSlug() {
		const params = new URLSearchParams({ slug: str(form.slug) || str(form.title) });
		if (kind === "posts") params.set("section", str(form.section));
		if (detail) params.set("excludeId", detail.id);
		setSlugSuggestion(null);
		try {
			const result = await api<{ slug: string; available: boolean; suggestion: string }>("GET", `${kind}/slug-check?${params}`);
			// What the server answers is shown, not written into the field: for an article that exists the slug is the address people already use.
			if (!detail && result.slug !== str(form.slug)) set("slug", result.slug);
			if (result.available) setSlugNote({ kind: "success", text: "Đường dẫn dùng được." });
			else {
				setSlugNote({ kind: "warning", text: "Đường dẫn đã có người dùng." });
				setSlugSuggestion(result.suggestion);
			}
		} catch (error) {
			setSlugNote({ kind: "warning", text: errorText(error) });
		}
	}

	function applySuggestedSlug() {
		if (!slugSuggestion) return;
		setSlugTouched(true);
		setSlugTyped(false);
		set("slug", slugSuggestion);
		setSlugSuggestion(null);
		setSlugNote(null);
		setFields((now) => Object.fromEntries(Object.entries(now).filter(([key]) => key !== "slug")));
	}

	const back = (
		<Link href={`/quan-tri/${ui.path}`} className="tq-back">
			← {ui.title}
		</Link>
	);

	if (id && loadError) {
		return (
			<>
				<PageHeader title={ui.title} back={back} />
				<Alert kind="error">{loadError}</Alert>
				<Button variant="secondary" onClick={() => void load()}>
					Thử lại
				</Button>
			</>
		);
	}
	if (id && !detail) return <Loading />;
	if (!id && !can(kind, "create")) {
		return (
			<>
				<PageHeader title={ui.addLabel} back={back} />
				<Alert kind="warning">Bạn không có quyền tạo {ui.one}.</Alert>
			</>
		);
	}

	const categories = (options.data?.categories ?? []).filter((item) => kind !== "posts" || item.section === form.section);
	const categorySlug = categories.find((item) => item.id === form.categoryId)?.slug ?? "";
	const status = detail?.status ?? "draft";
	// A live article cannot be scheduled: the server refuses (409 already_live) because the schedule would take it off the site until the time.
	const live = status === "published";
	const orphans = orphanErrors(fields, SHOWN_ERRORS[kind], ["version"]);
	const videoUrl = str((form.video as Form | null)?.url);
	const videoProblem = videoUrl.trim() && !youtubeId(videoUrl) ? "Không nhận ra địa chỉ video YouTube. Hãy dán địa chỉ dạng https://www.youtube.com/watch?v=… hoặc https://youtu.be/…" : undefined;
	const publicHref = detail ? ui.publicPath({ slug: detail.slug, section: detail.section }) : "";

	return (
		<>
			<PageHeader title={detail ? str(form.title) || "(chưa có tiêu đề)" : ui.addLabel} back={back}>
				{detail?.canUpdate ? (
					<Button variant="secondary" onClick={() => void preview()} disabled={saving}>
						Xem trước
					</Button>
				) : null}
				{editable ? (
					<Button busy={saving} onClick={() => void save()} aria-keyshortcuts="Control+S">
						{detail ? "Lưu" : "Tạo bản nháp"}
					</Button>
				) : null}
			</PageHeader>

			{!editable ? (
				<Alert kind="warning">{detail?.status === "published" || detail?.status === "scheduled" ? "Bài đang hiển thị trên trang; chỉ người có quyền xuất bản mới sửa được." : `Bạn chỉ xem được ${ui.one} này.`}</Alert>
			) : null}
			{conflict ? (
				<Alert kind="warning">
					Bài vừa được người khác lưu nên lần lưu của bạn bị từ chối. Tải bản mới nhất sẽ bỏ các thay đổi chưa lưu ở đây (hãy chép lại phần cần giữ trước).{" "}
					<Button variant="secondary" onClick={() => guard.ask(() => void load())}>
						Tải bản mới nhất
					</Button>
				</Alert>
			) : null}
			<LeaveNotice guard={guard} />
			{notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}
			{sanitized ? (
				<Alert kind="info">
					Hệ thống đã làm sạch một số định dạng không được hỗ trợ trong nội dung.{" "}
					{sanitized === "reloaded" ? "Trình soạn đã nạp lại đúng nội dung đã lưu." : "Phần bạn gõ thêm trong lúc lưu được giữ nguyên và sẽ được làm sạch ở lần lưu sau."}
				</Alert>
			) : null}
			{orphans.length ? (
				<Alert kind="error">
					Còn lỗi chưa gắn được vào ô nhập nào:
					<ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
						{orphans.map(([key, message]) => (
							<li key={key}>
								{key}: {message}
							</li>
						))}
					</ul>
				</Alert>
			) : null}
			{dirty && editable ? (
				<p className="tq-hint" role="status">
					Có thay đổi chưa lưu (Ctrl+S để lưu).
				</p>
			) : null}

			<div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
				<div style={{ flex: "999 1 520px", minWidth: 0 }}>
					<fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
						<div className="tq-panel">
							<TextField label="Tiêu đề" value={str(form.title)} onChange={(e) => set("title", e.target.value)} maxLength={300} required error={fields.title} />
							{kind === "teachings" ? <TextField label="Tên hiển thị (khi nhiều bài trùng tiêu đề)" value={str(form.name)} onChange={(e) => set("name", e.target.value)} maxLength={300} error={fields.name} /> : null}
							<TextField label="Tiêu đề phụ" value={str(form.subtitle)} onChange={(e) => set("subtitle", e.target.value)} maxLength={300} error={fields.subtitle} />
							<div className="tq-toolbar">
								<div className="tq-field" style={{ flex: "1 1 260px" }}>
									<label className="tq-label" htmlFor="content-slug">
										Đường dẫn
									</label>
									<input
										id="content-slug"
										className="tq-input"
										value={str(form.slug)}
										onChange={(e) => {
											setSlugTouched(true);
											setSlugTyped(true);
											setSlugNote(null);
											setSlugSuggestion(null);
											set("slug", e.target.value);
										}}
										onBlur={() => {
											// Only what was typed is made into a slug; the address an article already has is left exactly as stored.
											// (nothing is set when it is already a slug: setting clears the notice above and the page would jump under the click that caused this blur)
											const cleaned = slugOnBlur(str(form.slug), slugTyped);
											if (cleaned !== str(form.slug)) set("slug", cleaned);
											setSlugTyped(false);
										}}
										aria-describedby="content-slug-note"
										aria-invalid={fields.slug ? true : undefined}
									/>
								</div>
								<Button variant="secondary" onClick={() => void checkSlug()}>
									Kiểm tra
								</Button>
							</div>
							<p id="content-slug-note" className={fields.slug || slugNote?.kind === "warning" ? "tq-field-error" : "tq-hint"} role={fields.slug ? "alert" : undefined}>
								{slugSuggestion && fields.slug ? "Đường dẫn đã có người dùng." : (fields.slug ?? slugNote?.text ?? (kind === "posts" ? `/${str(form.section)}/${str(form.slug)}` : ui.publicPath({ slug: str(form.slug) })))}
							</p>
							{slugSuggestion ? (
								<p style={{ margin: "0 0 12px" }}>
									<Button variant="secondary" onClick={applySuggestedSlug}>
										Dùng đường dẫn gợi ý
									</Button>{" "}
									<span className="tq-hint">
										Gợi ý: <code>{slugSuggestion}</code>
									</span>
								</p>
							) : null}
							<TextArea label={ui.summaryLabel} value={str(form[ui.summaryKey])} onChange={(e) => set(ui.summaryKey, e.target.value)} rows={3} maxLength={kind === "pages" ? 4000 : 2000} error={fields[ui.summaryKey]} />
							{kind === "posts" ? <TextArea label="Lời dẫn (hiện trên đầu bài)" value={str(form.intro)} onChange={(e) => set("intro", e.target.value)} rows={3} maxLength={4000} error={fields.intro} /> : null}
						</div>
					</fieldset>

					{fields.contentHtml || fields.contentJson ? <Alert kind="error">{fields.contentHtml ?? fields.contentJson}</Alert> : null}
					<RichEditor
						key={editorKey}
						initial={editorSeed}
						readOnly={!editable}
						onChange={(value) => {
							bodyRef.current = value;
							setBody(value);
						}}
					/>
					{kind === "teachings" ? <p className="tq-hint">Trang Tông Chỉ hiển thị bài ở dạng chữ đơn giản: bảng, video, âm thanh, chú thích ảnh và chữ nghiêng trong thân bài sẽ hiện thành chữ thường.</p> : null}

					{kind === "pages" ? <MilestonesEditor items={(form.milestones as Milestone[]) ?? []} onChange={(items) => set("milestones", items)} disabled={!editable} error={Object.entries(fields).find(([key]) => key.startsWith("milestones"))?.[1]} /> : null}
					{kind === "posts" && detail ? <RelatedPanel postId={detail.id} initial={detail.related ?? []} disabled={!editable} /> : null}
				</div>

				<aside style={{ flex: "1 1 300px", minWidth: 0, display: "grid", gap: 16 }} aria-label="Thiết lập bài">
					<Section title="Trạng thái" id="trang-thai">
						<p>
							<Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
							{status === "scheduled" && detail?.publishAt ? <span> · đăng lúc {when(detail.publishAt)}</span> : null}
						</p>
						{detail ? (
							<p className="tq-muted" style={{ fontSize: 14 }}>
								Phiên bản {detail.version} · sửa {when(detail.updatedAt)}
								{detail.updatedByName ? ` bởi ${detail.updatedByName}` : ""}
								{detail.createdByName ? ` · tạo bởi ${detail.createdByName}` : ""}
							</p>
						) : (
							<p className="tq-muted">Bài mới được lưu thành bản nháp.</p>
						)}
						{detail && dirty ? <p className="tq-hint">Lưu thay đổi trước khi đổi trạng thái.</p> : null}
						{detail ? (
							<div style={{ display: "grid", gap: 8 }}>
								{status === "draft" && detail.canSubmit ? (
									<Button variant="secondary" disabled={saving || dirty} onClick={() => void act("submit", {}, "Đã gửi duyệt.")}>
										Gửi duyệt
									</Button>
								) : null}
								{detail.canPublish ? (
									<>
										{status !== "published" ? (
											<Button disabled={saving || dirty} onClick={() => void act("publish", {}, (next) => publishMessage(next, when, false))}>
												Xuất bản ngay
											</Button>
										) : null}
										<div className="tq-field" style={{ margin: 0 }}>
											<label className="tq-label" htmlFor="content-schedule">
												Hẹn giờ đăng (giờ Việt Nam)
											</label>
											<input
												id="content-schedule"
												className="tq-input"
												type="datetime-local"
												value={schedule}
												onChange={(e) => setSchedule(e.target.value)}
												disabled={live}
												aria-invalid={fields.publishAt ? true : undefined}
												aria-describedby={live ? "content-schedule-live" : undefined}
											/>
											{fields.publishAt ? <p className="tq-field-error">{fields.publishAt}</p> : null}
										</div>
										{live ? (
											<p id="content-schedule-live" className="tq-alert tq-alert--warning" role="status" style={{ margin: 0 }}>
												Bài đang hiển thị trên trang. Hẹn giờ sẽ gỡ bài khỏi trang cho tới giờ hẹn, nên không hẹn giờ được lúc này. Muốn hẹn giờ, hãy đưa bài về bản nháp trước.
											</p>
										) : null}
										<Button
											variant="secondary"
											disabled={saving || dirty || !schedule || live}
											onClick={() => {
												const at = vietnamInputToIso(schedule);
												if (!at || Date.parse(at) <= Date.now()) {
													setNotice({ kind: "error", text: "Chọn một thời điểm trong tương lai." });
													return;
												}
												void act("publish", { publishAt: at }, (next) => publishMessage(next, when, true));
											}}
										>
											Hẹn giờ
										</Button>
										{status !== "hidden" ? (
											<Button variant="secondary" disabled={saving || dirty} onClick={() => void act("hide", {}, "Đã tạm ẩn.")}>
												Tạm ẩn
											</Button>
										) : null}
										{status !== "draft" ? (
											<Button variant="secondary" disabled={saving || dirty} onClick={() => void act("unpublish", {}, "Đã đưa về bản nháp.")}>
												Đưa về bản nháp
											</Button>
										) : null}
									</>
								) : status !== "draft" ? (
									<p className="tq-hint">Biên tập viên sẽ duyệt và xuất bản.</p>
								) : null}
								{status === "published" ? (
									<a href={publicHref} target="_blank" rel="noopener noreferrer">
										Xem trên trang ↗
									</a>
								) : null}
							</div>
						) : null}
					</Section>

					<fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gap: 16 }}>
						<Section title="Phân loại" id="phan-loai">
							{kind === "posts" ? (
								<SelectField
									label="Chuyên trang"
									value={str(form.section)}
									onChange={(e) => {
										set("section", e.target.value);
										set("categoryId", null);
									}}
									error={fields.section}
								>
									{(options.data?.sections ?? []).map((item) => (
										<option key={item.slug} value={item.slug}>
											{item.name}
										</option>
									))}
								</SelectField>
							) : null}
							<SelectField label={ui.categoryLabel} value={str(form.categoryId)} onChange={(e) => set("categoryId", e.target.value || null)} error={fields.categoryId}>
								<option value="">— Chưa chọn —</option>
								{categories.map((item) => (
									<option key={item.id} value={item.id}>
										{item.name}
									</option>
								))}
							</SelectField>
							{kind === "posts" ? (
								<label className="tq-check">
									<input type="checkbox" checked={!!form.pinned} onChange={(e) => set("pinned", e.target.checked)} />
									<span>Ghim bài lên đầu</span>
								</label>
							) : null}
							{kind !== "pages" ? <TextField label="Ngày đăng" type="date" value={str(form.publishedDate)} onChange={(e) => set("publishedDate", e.target.value)} error={fields.publishedDate} /> : null}
							{kind !== "pages" ? <TextField label="Tác giả" value={str(form.author)} onChange={(e) => set("author", e.target.value)} maxLength={200} error={fields.author} /> : null}
							{kind === "teachings" ? <TextField label="Liên kết tác giả" value={str(form.authorHref)} onChange={(e) => set("authorHref", e.target.value || null)} placeholder="/gioi-thieu/…" error={fields.authorHref} /> : null}
							{kind === "pages" ? <TextField label="Nhãn nhỏ trên tiêu đề" value={str(form.kicker)} onChange={(e) => set("kicker", e.target.value)} maxLength={200} error={fields.kicker} /> : null}
							{kind !== "posts" ? <TextField label="Thứ tự hiển thị" type="number" value={String(form.position ?? 0)} onChange={(e) => set("position", Math.trunc(Number(e.target.value) || 0))} error={fields.position} /> : null}
						</Section>

						{kind === "posts" && categorySlug ? (
							<ExtraFields categorySlug={categorySlug} extra={(form.extra as Form) ?? {}} onChange={(extra) => set("extra", extra)} media={media} onMedia={(preview) => rememberMedia(preview)} errors={fields} disabled={!editable} />
						) : null}

						<Section title="Hình ảnh" id="hinh-anh">
							{kind === "posts" ? (
								<MediaField
									label="Ảnh đại diện (thẻ bài)"
									mediaId={(form.thumbnailMediaId as string | null) ?? null}
									preview={media[str(form.thumbnailMediaId)]}
									position={str(form.thumbnailPosition)}
									onChange={(value, preview) => {
										rememberMedia(preview);
										set("thumbnailMediaId", value);
									}}
									onPosition={(value) => set("thumbnailPosition", value)}
									error={fields.thumbnailMediaId}
									disabled={!editable}
								/>
							) : null}
							<MediaField
								label="Ảnh bìa (banner)"
								mediaId={(form.bannerMediaId as string | null) ?? null}
								preview={media[str(form.bannerMediaId)]}
								position={str(form.bannerPosition)}
								onChange={(value, preview) => {
									rememberMedia(preview);
									set("bannerMediaId", value);
								}}
								onPosition={(value) => set("bannerPosition", value)}
								error={fields.bannerMediaId}
								disabled={!editable}
							/>
							{kind === "pages" ? (
								<MediaField
									label="Ảnh chân dung (3:4)"
									mediaId={(form.portraitMediaId as string | null) ?? null}
									preview={media[str(form.portraitMediaId)]}
									position={str(form.portraitPosition)}
									onChange={(value, preview) => {
										rememberMedia(preview);
										set("portraitMediaId", value);
									}}
									onPosition={(value) => set("portraitPosition", value)}
									error={fields.portraitMediaId}
									disabled={!editable}
								/>
							) : null}
						</Section>

						{kind === "teachings" ? (
							<Section title="Video kèm bài" id="video-kem">
								<TextField
									label="Địa chỉ video YouTube"
									value={videoUrl}
									onChange={(e) => sub("video", "url", e.target.value)}
									onBlur={(e) => {
										// A pasted watch, share or embed address becomes the watch address; one that is not recognised is left as typed.
										const value = normalizeYoutubeUrl(e.target.value);
										if (value !== e.target.value) sub("video", "url", value);
									}}
									placeholder="https://www.youtube.com/watch?v=…"
									hint={youtubeId(videoUrl) ? `Mã video: ${youtubeId(videoUrl)}. Để trống ô này để gỡ video khỏi bài.` : "Dán địa chỉ video (watch, youtu.be hoặc embed). Để trống để gỡ video khỏi bài."}
									error={errorAt(fields, "video.url") ?? fields.video ?? videoProblem}
								/>
								<TextField label="Tiêu đề video" value={str((form.video as Form | null)?.title)} onChange={(e) => sub("video", "title", e.target.value)} error={errorAt(fields, "video.title")} />
								<TextArea label="Mô tả video" value={str((form.video as Form | null)?.description)} onChange={(e) => sub("video", "description", e.target.value)} rows={2} error={errorAt(fields, "video.description")} />
							</Section>
						) : null}

						{kind === "pages" ? (
							<Section title="Trích dẫn" id="trich-dan">
								<TextField label="Tiêu đề trích dẫn" value={str((form.quote as Form | null)?.title)} onChange={(e) => sub("quote", "title", e.target.value)} error={errorAt(fields, "quote.title")} />
								<TextArea
									label="Các câu (mỗi dòng một câu)"
									value={(((form.quote as Form | null)?.lines as string[] | undefined) ?? []).join("\n")}
									onChange={(e) => sub("quote", "lines", e.target.value.split("\n"))}
									rows={4}
									error={errorAt(fields, "quote.lines")}
								/>
								<TextField label="Tác giả" value={str((form.quote as Form | null)?.author)} onChange={(e) => sub("quote", "author", e.target.value)} error={errorAt(fields, "quote.author")} />
							</Section>
						) : null}

						{kind !== "posts" ? (
							<Section title={kind === "pages" ? "Tác phẩm" : "Sách nguồn"} id="sach">
								<TextField label="Tên sách" value={str((form.book as Form | null)?.title)} onChange={(e) => sub("book", "title", e.target.value)} error={errorAt(fields, "book.title")} />
								<TextField label="Tác giả" value={str((form.book as Form | null)?.author)} onChange={(e) => sub("book", "author", e.target.value)} error={errorAt(fields, "book.author")} />
								<TextArea label="Giới thiệu" value={str((form.book as Form | null)?.description)} onChange={(e) => sub("book", "description", e.target.value)} rows={2} error={errorAt(fields, "book.description")} />
								{kind === "teachings" ? <TextField label="Liên kết" value={str((form.book as Form | null)?.href)} onChange={(e) => sub("book", "href", e.target.value || null)} error={errorAt(fields, "book.href")} /> : null}
								<CoverField value={str((form.book as Form | null)?.cover)} onChange={(value) => sub("book", "cover", value || null)} error={errorAt(fields, "book.cover")} />
							</Section>
						) : null}

						<Section title="SEO và chia sẻ" id="seo">
							<TextField label="Tiêu đề SEO" value={str(form.seoTitle)} onChange={(e) => set("seoTitle", e.target.value)} maxLength={200} hint={`${str(form.seoTitle).length}/60 ký tự nên dùng; để trống thì dùng tiêu đề bài.`} error={fields.seoTitle} />
							<TextArea label="Mô tả SEO" value={str(form.seoDescription)} onChange={(e) => set("seoDescription", e.target.value)} maxLength={400} rows={3} hint={`${str(form.seoDescription).length}/160 ký tự nên dùng.`} error={fields.seoDescription} />
							<MediaField
								label="Ảnh khi chia sẻ (OG)"
								mediaId={(form.ogMediaId as string | null) ?? null}
								preview={media[str(form.ogMediaId)]}
								onChange={(value, preview) => {
									rememberMedia(preview);
									set("ogMediaId", value);
								}}
								error={fields.ogMediaId}
								disabled={!editable}
							/>
						</Section>
					</fieldset>

					{detail ? <RevisionPanel kind={kind} id={detail.id} version={detail.version} canRestore={detail.canUpdate} guard={guard.ask} onRestored={() => void load().then(() => setNotice({ kind: "success", text: "Đã khôi phục thành phiên bản mới." }))} /> : null}

					{detail ? (
						<Section title="Thao tác khác" id="thao-tac">
							<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
								{can(kind, "create") ? (
									<Button variant="secondary" onClick={() => guard.ask(() => void duplicate())}>
										Nhân bản
									</Button>
								) : null}
								{detail.canDelete ? (
									confirmDelete ? (
										<span role="group" aria-label="Xác nhận xóa" style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
											<span>Chuyển {ui.one} vào thùng rác?</span>
											<Button variant="danger" onClick={() => void remove()}>
												Xóa
											</Button>
											<Button variant="secondary" onClick={() => setConfirmDelete(false)}>
												Hủy
											</Button>
										</span>
									) : (
										<Button variant="danger" onClick={() => setConfirmDelete(true)}>
											Xóa
										</Button>
									)
								) : null}
							</div>
						</Section>
					) : null}
				</aside>
			</div>
		</>
	);
}

/** A picture address for a book cover: typed, or taken from the library. */
function CoverField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
	const [picking, setPicking] = useState(false);
	return (
		<div>
			<TextField label="Ảnh bìa sách (địa chỉ)" value={value} onChange={(e) => onChange(e.target.value)} placeholder="/anh-goc/…" error={error} />
			{value ? <img src={value} alt="" style={{ width: 90, borderRadius: 4, marginBottom: 6 }} /> : null}
			<div>
				<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => setPicking((now) => !now)} aria-expanded={picking}>
					Chọn từ thư viện
				</button>
			</div>
			{picking ? (
				<MediaPicker
					onPick={(item) => {
						onChange(item.url);
						setPicking(false);
					}}
					onCancel={() => setPicking(false)}
				/>
			) : null}
		</div>
	);
}
