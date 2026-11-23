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
create table statue_cluster (id text primary key, name text, assembly_id text, area_id text, description text default '');
create table statue (
  id text primary key, code text default '', slug text, name text, subtitle text default '', area_id text, area_code text default '', cluster_id text, assembly_id text,
  is_main integer default 0, image_media_id text, image_position text default 'center 50%', quote_text text, quote_author text, body text default '', position integer default 0,
  updated_at text, created_by text, updated_by text, deleted_at text, deleted_by text, version integer default 1, editorial_board text default '', specs text default '{}',
  status text default 'published', seo_title text, seo_description text);
create table art_variation (
  id text primary key, statue_id text, position integer, variation_id text default '', art_statue_id text, title text default '', location text default '', meaning text default '',
  image_media_id text, image_position text default 'center 50%');
create table statue_image (statue_id text, position integer, media_id text, label text default '', image_position text default 'center 50%', primary key (statue_id, position));
create table statue_related (statue_id text, related_id text, position integer default 0, primary key (statue_id, related_id));
create table setting (key text primary key, value text);
create table menu (id text primary key, name text);
create table menu_item (
  id text primary key, menu_id text, parent_id text, position integer default 0, label text, link_type text default 'url', category_id text, href text default '',
  open_new_tab integer default 0, visible integer default 1, icon_type text default 'none', icon_name text default '', icon_svg text default '', icon_media_id text,
  icon_url text default '', icon_color text default '', updated_at text, updated_by text, deleted_at text, deleted_by text);
create table redirect (from_path text primary key, to_path text, code integer default 301, note text default '', hits integer default 0, active integer default 1, created_by text, created_at text);
`;

/** A D1-shaped reader over any node:sqlite database: the in-memory stand-in below, or a real migrated file (tests/helpers/real-db.ts). */
export function d1Over(sqlite: DatabaseSync): D1Like {
	return {
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

export type FakeD1 = D1Like & { exec(sql: string): void; insert(table: string, row: Record<string, unknown>): void };

export function createFakeD1(): FakeD1 {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(SCHEMA);
	return {
		...d1Over(sqlite),
		exec: (sql) => sqlite.exec(sql),
		insert(table, row) {
			const columns = Object.keys(row);
			sqlite.prepare(`insert into ${table} (${columns.join(",")}) values (${columns.map(() => "?").join(",")})`).run(...(Object.values(row) as never[]));
		},
	};
}

/** ISO time `days` from now (negative: in the past), the format www stores. */
export const isoIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
