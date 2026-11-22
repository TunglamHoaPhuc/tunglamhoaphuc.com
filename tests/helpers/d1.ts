// A D1 stand-in on node:sqlite for the tests: just the tables and columns the V3 reader (src/lib/tlhp-content/sources/d1.ts)
// reads, with the same table and column names as www's schema (src/db/schema.ts, migrations of the www repo). It lets a test
// run the reader's real SQL (the "live" filter: published or scheduled-and-due, not in the trash, area visible).
import { DatabaseSync } from "node:sqlite";
import type { D1Like } from "@/lib/tlhp-content/sources/d1";

const SCHEMA = `
create table media (id text primary key, r2_key text, url text);
create table category (id text primary key, slug text, name text, kind text);
create table page_view (entity_type text, entity_id text, count integer);
create table album_item (album_id text, media_id text, title text default '', caption text default '', position integer default 0);
create table post (
  pinned integer default 0, seo_title text, seo_description text, og_media_id text, extra text,
  id text primary key, slug text, title text, subtitle text default '', section text, author text default '', published_date text default '',
  summary text default '', gallery_count integer default 0, legacy_views integer default 0, thumbnail_position text default '', banner_position text default '',
  category_id text, thumbnail_media_id text, banner_media_id text, album_id text, intro text default '', content_html text default '', keywords text, videos text,
  status text default 'published', publish_at text, deleted_at text);
create table page (
  id text primary key, slug text, title text, subtitle text default '', kicker text default '', group_id text, banner_media_id text, banner_position text default '',
  portrait_media_id text, portrait_position text default '', overview text default '', quote text, content_html text default '', book text, position integer default 0,
  status text default 'published', publish_at text, deleted_at text);
create table post_related (post_id text, target_type text, target_id text, position integer default 0);
create table milestone (page_id text, label text, title text, description text, position integer default 0);
create table teaching_article (
  seo_title text, seo_description text, og_media_id text,
  id text primary key, slug text, title text, name text default '', subtitle text default '', group_id text, banner_media_id text, banner_position text default '',
  excerpt text default '', author text default '', author_href text, published_date text default '', video text, featured text, book text, keywords text,
  body text default '', content_html text default '', legacy_views integer default 0, position integer default 0,
  status text default 'published', publish_at text, deleted_at text);
create table area (
  id text primary key, slug text, name text, subtitle text default '', temple text default '', cover_media_id text, cover_position text default '',
  map_x real, map_y real, intro text default '', content_html text default '', position integer default 0, visible integer default 1, deleted_at text);
create table calendar_event (
  id text primary key, slug text, title text, subtitle text default '', category_id text, start_date text, end_date text, times text, location text default '',
  description text default '', notes text default '', image_media_id text, image_position text default '', video text, position integer default 0,
  status text default 'published', deleted_at text);
create table featured_program (id text primary key, title text, subtitle text default '', summary text default '', time text default '', duration text default '', location text default '', image_media_id text, image_position text default '', position integer default 0);
create table month_theme (month integer primary key, title text, poster_media_id text, lines text, author text default '');
create table quote_image (id text primary key, title text default '', media_id text, position integer default 0);
`;

export type FakeD1 = D1Like & { exec(sql: string): void; insert(table: string, row: Record<string, unknown>): void };

export function createFakeD1(): FakeD1 {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(SCHEMA);
	return {
		exec: (sql) => sqlite.exec(sql),
		insert(table, row) {
			const columns = Object.keys(row);
			sqlite.prepare(`insert into ${table} (${columns.join(",")}) values (${columns.map(() => "?").join(",")})`).run(...(Object.values(row) as never[]));
		},
		prepare(sql) {
			let values: unknown[] = [];
			const statement = {
				bind(...params: unknown[]) {
					values = params;
					return statement;
				},
				async all<T>() {
					return { results: sqlite.prepare(sql).all(...(values as never[])) as T[] };
				},
			};
			return statement;
		},
	};
}

/** ISO time `days` from now (negative: in the past), the format www stores. */
export const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
