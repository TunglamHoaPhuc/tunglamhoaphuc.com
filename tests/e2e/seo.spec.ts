import { expect, test, type APIRequestContext } from "@playwright/test";

// T20: what search engines are told. The public site (www) may be indexed, every other host
// (v2., quantri., local) may not. Requests send the public host in the Host header to see
// what www will answer, which only works against a local build; on a deployed copy the same
// checks cover the host that copy really has.
const PUBLIC_HOST = "www.tunglamhoaphuc.com";
const LOCAL = !process.env.BASE_URL || /localhost|127\.0\.0\.1/.test(process.env.BASE_URL);
const BEXON = /Bexon/i;

// Playwright reads the first argument as the list of fixtures to set up, so it must be a pattern.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
	test.skip(testInfo.project.name !== "desktop", "answers are the same on a phone");
});

const asPublic = (request: APIRequestContext, path: string) => request.get(path, { headers: { host: PUBLIC_HOST }, maxRedirects: 0 });

function titleOf(html: string): string {
	return (html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").trim();
}

function jsonLd(html: string): Record<string, unknown>[] {
	return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1].replace(/\\u003c/g, "<")));
}

test.describe("the host decides what may be indexed", () => {
	test("this host says noindex in the header and disallows everything in robots.txt", async ({ request }) => {
		test.skip(LOCAL === false && /(^|\/\/)www\./.test(process.env.BASE_URL ?? ""), "this copy is the public site");
		const page = await request.get("/lich-tu-hoc");
		expect(page.headers()["x-robots-tag"]).toBe("noindex, nofollow");
		const robots = await (await request.get("/robots.txt")).text();
		expect(robots).toMatch(/User-agent: \*\s+Disallow: \//i);
		expect(robots).not.toMatch(/Sitemap:/i);
	});

	test("the public host has no noindex header and may be crawled", async ({ request }) => {
		test.skip(!LOCAL, "needs a local build to send another Host");
		const page = await asPublic(request, "/lich-tu-hoc");
		expect(page.status()).toBe(200);
		expect(page.headers()["x-robots-tag"]).toBeUndefined();
		const robots = await (await asPublic(request, "/robots.txt")).text();
		expect(robots).toMatch(/Allow: \//);
		expect(robots).toContain(`Sitemap: https://${PUBLIC_HOST}/sitemap.xml`);
		for (const hidden of ["/tim-kiem", "/cdn-cgi/", "/anh-goc/"]) expect(robots).toContain(`Disallow: ${hidden}`);
		expect(robots).not.toMatch(/Disallow: \/\s*$/m);
	});

	test("Bexon's sample pages and the style guide are 404 on the public host, open elsewhere", async ({ request }) => {
		test.skip(!LOCAL, "needs a local build to send another Host");
		for (const path of ["/styleguide", "/contact", "/blogs", "/blogs/1", "/services", "/team", "/history", "/our-gallery", "/portfolios"]) {
			expect((await asPublic(request, path)).status(), `${path} on www`).toBe(404);
		}
		for (const path of ["/styleguide", "/contact", "/blogs"]) expect((await request.get(path)).status(), `${path} here`).toBe(200);
	});
});

test.describe("sitemap.xml", () => {
	test("lists every public page once, on the host that asks", async ({ request }) => {
		test.skip(!LOCAL, "needs a local build to send another Host");
		const response = await asPublic(request, "/sitemap.xml");
		expect(response.status()).toBe(200);
		expect(response.headers()["content-type"]).toContain("xml");
		const xml = await response.text();
		const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
		expect(new Set(locs).size).toBe(locs.length);
		expect(locs.length).toBeGreaterThan(700);
		for (const loc of locs) expect(loc.startsWith(`https://${PUBLIC_HOST}/`), loc).toBe(true);
		for (const path of ["/", "/gioi-thieu", "/tong-chi-tu-hoc", "/dong-chay-hoang-phap", "/vu-tru-phat-giao", "/bao-tuong-phat-giao", "/tri-tue-phat-phap", "/lich-tu-hoc", "/lien-he", "/vu-tru-phat-giao/tam-bao", "/gioi-thieu/tieu-su-su-to"]) {
			expect(locs, path).toContain(`https://${PUBLIC_HOST}${path === "/" ? "/" : path}`);
		}
		// Pages that must stay out: search, the style guide, Bexon's samples.
		for (const loc of locs) expect(loc).not.toMatch(/\/(tim-kiem|styleguide|contact|blogs|services|team|history|our-gallery|portfolios)(\/|\?|$)/);
		expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}/);
	});

	test("a sample of its addresses answer 200 and carry a title of their own", async ({ request }) => {
		const xml = await (await request.get("/sitemap.xml")).text();
		const paths = [...xml.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((match) => match[1]);
		const sample = paths.filter((_, index) => index % 40 === 0).slice(0, 24);
		expect(sample.length).toBeGreaterThan(10);
		for (const path of sample) {
			const response = await request.get(path);
			expect(response.status(), path).toBe(200);
			const title = titleOf(await response.text());
			expect(title, path).not.toBe("");
			expect(title, path).not.toMatch(BEXON);
		}
	});
});

test.describe("titles", () => {
	test("no two of the section, topic, area and teaching pages share a title", async ({ request }) => {
		const xml = await (await request.get("/sitemap.xml")).text();
		const paths = [...xml.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)]
			.map((match) => match[1])
			.filter((path) => /^\/(gioi-thieu|tong-chi-tu-hoc|vu-tru-phat-giao)(\/|$)/.test(path) || ["/", "/lich-tu-hoc", "/lien-he", "/dong-chay-hoang-phap", "/tri-tue-phat-phap", "/bao-tuong-phat-giao"].includes(path));
		expect(paths.length).toBeGreaterThan(30);
		const seen = new Map<string, string>();
		for (const path of paths) {
			const response = await request.get(path);
			expect(response.status(), path).toBe(200);
			const title = titleOf(await response.text());
			expect(title, path).not.toMatch(BEXON);
			expect(seen.get(title), `"${title}" is the title of ${path} and ${seen.get(title)}`).toBeUndefined();
			seen.set(title, path);
		}
	});
});

test.describe("structured data and share cards", () => {
	test("the home page describes the temple as an organisation", async ({ request }) => {
		const [organization] = jsonLd(await (await request.get("/")).text());
		expect(organization["@type"]).toEqual(["Organization", "BuddhistTemple"]);
		expect(organization.name).toBe("Tùng Lâm Hòa Phúc");
		expect(organization.telephone).toBe("+84979345373");
		expect(organization.url).toBe("https://www.tunglamhoaphuc.com/");
	});

	test("a post is an Article with its date and its own address", async ({ request }) => {
		const path = "/dong-chay-hoang-phap/cong-tu-phap-hoi-niem-phat-thang-7-nam-binh-ngo-2026-2";
		const [article] = jsonLd(await (await request.get(path)).text());
		expect(article["@type"]).toBe("Article");
		expect(article.mainEntityOfPage).toBe(`https://www.tunglamhoaphuc.com${path}`);
		expect(String(article.datePublished)).toMatch(/^\d{4}-\d{2}-\d{2}/);
		expect(String(article.headline).length).toBeLessThanOrEqual(110);
	});

	test("the schedule gives each event of the month as an Event with dates and a place", async ({ request }) => {
		const html = await (await request.get("/lich-tu-hoc?thang=2026-11")).text();
		const events = jsonLd(html).filter((item) => item["@type"] === "Event");
		expect(events.length).toBeGreaterThan(0);
		for (const event of events) {
			expect(String(event.name).length).toBeGreaterThan(0);
			expect(String(event.startDate)).toMatch(/^2026-11-\d{2}$/);
			expect(String(event.endDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect((event.location as { name: string }).name).not.toBe("");
		}
	});

	test("the contact page names the temple as a place", async ({ request }) => {
		const place = jsonLd(await (await request.get("/lien-he")).text()).find((item) => item["@type"] === "Place");
		// the temple's own link is a short Google Maps address
		expect(place?.hasMap).toMatch(/^https:\/\/(www\.google\.com\/maps|maps\.app\.goo\.gl\/)/);
	});

	test("every page names the card a shared link shows, with icons and a manifest", async ({ request }) => {
		const html = await (await request.get("/")).text();
		expect(html).toMatch(/<meta property="og:image" content="https:\/\/www\.tunglamhoaphuc\.com\/brand\/og-tung-lam-hoa-phuc\.jpg"/);
		expect(html).toMatch(/<meta property="og:locale" content="vi_VN"/);
		expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/);
		expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"/);
		expect(html).toMatch(/rel="apple-touch-icon"/);
		expect(html).not.toMatch(BEXON);

		const card = await request.get("/brand/og-tung-lam-hoa-phuc.jpg");
		expect(card.status()).toBe(200);
		expect(card.headers()["content-type"]).toContain("image/jpeg");
		expect((await card.body()).length).toBeLessThan(300 * 1024);

		const manifest = await (await request.get("/manifest.webmanifest")).json();
		expect(manifest.name).toBe("Tùng Lâm Hòa Phúc");
		expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
		for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
	});

	test("a page's canonical address is its own, on the public host", async ({ request }) => {
		const html = await (await request.get("/lich-tu-hoc")).text();
		expect(html).toMatch(/<link rel="canonical" href="https:\/\/www\.tunglamhoaphuc\.com\/lich-tu-hoc"/);
	});
});
