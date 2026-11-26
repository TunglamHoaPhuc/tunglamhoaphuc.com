import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { AdminDb } from "@/admin/db";
import { kindByPath } from "@/admin/content/kinds";
import { isAdminHost } from "@/admin/http/origin";
import { loadPreview, type PreviewData } from "@/admin/content/service";
import SiteShell from "@/components/layout/SiteShell";
import { PagePreview, PostPreview, TeachingPreview } from "@/components/admin/content/PreviewArticles";
import { PREVIEW_SITE_MAY_DIFFER } from "@/components/admin/content/previewNote";

// The preview of a draft (docs/admin-architecture.md 7.4): opened with a signed link that names one version of one
// article and lasts 30 minutes, so it needs no session. Made on every request, never cached, never indexed.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Bản xem trước", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

type Props = { params: Promise<{ loai: string; id: string }>; searchParams: Promise<{ token?: string | string[] }> };

async function workerEnv(): Promise<Record<string, unknown> | undefined> {
	try {
		return ((await import("cloudflare:workers" as string)) as { env?: Record<string, unknown> }).env;
	} catch {
		return undefined;
	}
}

// The admin layout wraps every page under /quan-tri in its own look (.tq); the preview must look like the site, so it
// takes that class off its wrapper before the first paint and resets what the wrapper itself sets.
const UNWRAP = "(function(s){var w=s&&s.closest('.tq');if(w)w.classList.remove('tq');})(document.currentScript)";
const RESET = ".tq:has(> .tlhp-preview){all:unset;display:block}.tlhp-preview-bar{position:sticky;top:0;z-index:1000;background:#7a1f12;color:#fff;text-align:center;padding:8px 12px;font:600 15px/1.4 system-ui,sans-serif}";

function Frame({ children, note }: { children: ReactNode; note: string }) {
	return (
		<div className="tlhp-preview" data-theme="dark">
			<script dangerouslySetInnerHTML={{ __html: UNWRAP }} />
			<style>{RESET}</style>
			<p className="tlhp-preview-bar" role="status">
				Bản xem trước — chưa xuất bản. {note} {PREVIEW_SITE_MAY_DIFFER}
			</p>
			{children}
		</div>
	);
}

function Refused({ message }: { message: string }) {
	return (
		<main style={{ maxWidth: 640, margin: "80px auto", padding: 16 }}>
			<h1 className="tq-h1">Không mở được bản xem trước</h1>
			<p className="tq-alert tq-alert--warning" role="alert">
				{message}
			</p>
		</main>
	);
}

export default async function PreviewPage({ params, searchParams }: Props) {
	// The admin exists on one address only (as in the API dispatcher): on any other host this page is not there.
	const env = await workerEnv();
	if (!isAdminHost((await headers()).get("host"), typeof env?.ADMIN_BASE_URL === "string" ? env.ADMIN_BASE_URL : undefined)) notFound();
	const { loai, id } = await params;
	const raw = (await searchParams).token;
	const token = Array.isArray(raw) ? raw[0] : raw;
	const kind = kindByPath(loai);
	if (!kind || !token) return <Refused message="Liên kết xem trước không đầy đủ. Hãy mở lại từ nút “Xem trước” trong trang soạn bài." />;
	if (!env?.DB || typeof env.ADMIN_JWT_SECRET !== "string") return <Refused message="Máy chủ chưa được cấu hình cho trang quản trị." />;
	let data: PreviewData | null = null;
	try {
		data = await loadPreview(env.DB as AdminDb, env.ADMIN_JWT_SECRET, new Date(), kind, decodeURIComponent(id), token);
	} catch (error) {
		console.error("preview", error);
	}
	if (!data) return <Refused message="Liên kết xem trước đã hết hạn (30 phút) hoặc không hợp lệ. Hãy bấm “Xem trước” trong trang soạn bài để lấy liên kết mới." />;
	const note = `Phiên bản ${data.version}.`;
	return (
		<Frame note={note}>
			<SiteShell announcement={null}>{kind.name === "posts" ? <PostPreview data={data} /> : kind.name === "teachings" ? <TeachingPreview data={data} /> : <PagePreview data={data} />}</SiteShell>
		</Frame>
	);
}
