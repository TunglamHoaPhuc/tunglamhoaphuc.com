CREATE TABLE `menu` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_item` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_id` text NOT NULL,
	`parent_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`label` text NOT NULL,
	`link_type` text DEFAULT 'url' NOT NULL,
	`category_id` text,
	`href` text DEFAULT '' NOT NULL,
	`open_new_tab` integer DEFAULT false NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`icon_type` text DEFAULT 'none' NOT NULL,
	`icon_name` text DEFAULT '' NOT NULL,
	`icon_svg` text DEFAULT '' NOT NULL,
	`icon_media_id` text,
	`icon_url` text DEFAULT '' NOT NULL,
	`icon_color` text DEFAULT '' NOT NULL,
	`updated_at` text,
	`updated_by` text,
	`deleted_at` text,
	`deleted_by` text,
	FOREIGN KEY (`menu_id`) REFERENCES `menu`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`icon_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `menu_item_tree` ON `menu_item` (`menu_id`,`parent_id`,`position`);--> statement-breakpoint
CREATE TABLE `post_related` (
	`post_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`post_id`, `target_type`, `target_id`),
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quote` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text,
	`deleted_by` text
);
--> statement-breakpoint
CREATE TABLE `revision` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revision_entity_version` ON `revision` (`entity_type`,`entity_id`,`version`);--> statement-breakpoint
CREATE TABLE `statue_image` (
	`statue_id` text NOT NULL,
	`position` integer NOT NULL,
	`media_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`image_position` text DEFAULT 'center 50%' NOT NULL,
	PRIMARY KEY(`statue_id`, `position`),
	FOREIGN KEY (`statue_id`) REFERENCES `statue`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `statue_related` (
	`statue_id` text NOT NULL,
	`related_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`statue_id`, `related_id`),
	FOREIGN KEY (`statue_id`) REFERENCES `statue`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_id`) REFERENCES `statue`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `area` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `area` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `area` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `area` ADD `deleted_by` text;--> statement-breakpoint
ALTER TABLE `area` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `area` ADD `featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `area` ADD `featured_position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `deleted_by` text;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `lunar_day` integer;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `lunar_month` integer;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `lunar_year` integer;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `lunar_leap` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `lunar_manual` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `registration_status` text DEFAULT 'closed' NOT NULL;--> statement-breakpoint
ALTER TABLE `calendar_event` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `category` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `icon_type` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `icon_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `icon_svg` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `icon_media_id` text REFERENCES media(id);--> statement-breakpoint
ALTER TABLE `category` ADD `icon_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `icon_color` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `template` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `visible` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `seo_title` text;--> statement-breakpoint
ALTER TABLE `category` ADD `seo_description` text;--> statement-breakpoint
ALTER TABLE `category` ADD `og_media_id` text REFERENCES media(id);--> statement-breakpoint
ALTER TABLE `category` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `category` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `category` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `category` ADD `deleted_by` text;--> statement-breakpoint
ALTER TABLE `page` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `page` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `page` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `page` ADD `deleted_by` text;--> statement-breakpoint
ALTER TABLE `page` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `page` ADD `publish_at` text;--> statement-breakpoint
ALTER TABLE `page` ADD `content_json` text;--> statement-breakpoint
ALTER TABLE `page` ADD `seo_title` text;--> statement-breakpoint
ALTER TABLE `page` ADD `seo_description` text;--> statement-breakpoint
ALTER TABLE `page` ADD `og_media_id` text REFERENCES media(id);--> statement-breakpoint
ALTER TABLE `page` ADD `search_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `post` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `post` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `post` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `post` ADD `deleted_by` text;--> statement-breakpoint
ALTER TABLE `post` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `post` ADD `publish_at` text;--> statement-breakpoint
ALTER TABLE `post` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `post` ADD `og_media_id` text REFERENCES media(id);--> statement-breakpoint
ALTER TABLE `post` ADD `content_json` text;--> statement-breakpoint
ALTER TABLE `post` ADD `extra` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `post` ADD `search_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `redirect` ADD `note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `redirect` ADD `hits` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `redirect` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `redirect` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `redirect` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `statue` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `statue` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `statue` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `statue` ADD `deleted_by` text;--> statement-breakpoint
ALTER TABLE `statue` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `statue` ADD `editorial_board` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `statue` ADD `specs` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `statue` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `statue` ADD `seo_title` text;--> statement-breakpoint
ALTER TABLE `statue` ADD `seo_description` text;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `deleted_by` text;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `publish_at` text;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `content_json` text;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `seo_title` text;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `seo_description` text;--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `og_media_id` text REFERENCES media(id);--> statement-breakpoint
ALTER TABLE `teaching_article` ADD `search_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- ===== Added by hand (drizzle-kit does not generate data steps) =====
-- 1. Status words: the new set is draft, pending, published, scheduled, hidden.
UPDATE `post` SET `status` = 'pending' WHERE `status` = 'review';--> statement-breakpoint
UPDATE `post` SET `status` = 'hidden' WHERE `status` = 'archived';--> statement-breakpoint
UPDATE `teaching_article` SET `status` = 'pending' WHERE `status` = 'review';--> statement-breakpoint
UPDATE `teaching_article` SET `status` = 'hidden' WHERE `status` = 'archived';--> statement-breakpoint
UPDATE `page` SET `status` = 'pending' WHERE `status` = 'review';--> statement-breakpoint
UPDATE `page` SET `status` = 'hidden' WHERE `status` = 'archived';--> statement-breakpoint
-- 2. Posts that share a slug inside a section: the later ones (by date) get -2, -3 … so every address is reachable.
--    The old admin let two posts share a slug; the second was unreachable.
WITH d AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY section, slug ORDER BY published_date, id) AS rn FROM `post`)
UPDATE `post` SET `slug` = `slug` || '-' || (SELECT rn FROM d WHERE d.id = `post`.id) WHERE id IN (SELECT id FROM d WHERE rn > 1);--> statement-breakpoint
WITH d AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY start_date, id) AS rn FROM `calendar_event`)
UPDATE `calendar_event` SET `slug` = `slug` || '-' || (SELECT rn FROM d WHERE d.id = `calendar_event`.id) WHERE id IN (SELECT id FROM d WHERE rn > 1);--> statement-breakpoint
-- 3. Slugs and codes are unique among rows that are not in the trash (a trashed row keeps its slug without blocking a new one).
DROP INDEX IF EXISTS `page_slug_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `teaching_article_slug_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `area_slug_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `statue_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `post_section_slug_live` ON `post` (`section`, `slug`) WHERE `deleted_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `page_slug_live` ON `page` (`slug`) WHERE `deleted_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `teaching_article_slug_live` ON `teaching_article` (`slug`) WHERE `deleted_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `area_slug_live` ON `area` (`slug`) WHERE `deleted_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `statue_slug_live` ON `statue` (`slug`) WHERE `deleted_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `statue_code_live` ON `statue` (`code`) WHERE `deleted_at` IS NULL AND `code` <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `category_live` ON `category` (`kind`, `section`, `slug`) WHERE `deleted_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_event_slug_live` ON `calendar_event` (`slug`) WHERE `deleted_at` IS NULL;--> statement-breakpoint
-- 4. Indexes for the admin's lists, the trash and scheduled posts.
CREATE INDEX `post_list` ON `post` (`section`, `status`, `published_date`);--> statement-breakpoint
CREATE INDEX `post_created_by` ON `post` (`created_by`);--> statement-breakpoint
CREATE INDEX `post_trash` ON `post` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `post_scheduled` ON `post` (`publish_at`) WHERE `status` = 'scheduled';--> statement-breakpoint
CREATE INDEX `teaching_article_trash` ON `teaching_article` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `page_trash` ON `page` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `statue_trash` ON `statue` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `event_trash` ON `calendar_event` (`deleted_at`) WHERE `deleted_at` IS NOT NULL;--> statement-breakpoint
-- 5. The three menus; the header one starts as the menu the site has shown so far (src/config/site.ts).
INSERT INTO `menu` (`id`, `name`) VALUES ('header', 'Menu đầu trang'), ('footer', 'Menu chân trang'), ('sidebar', 'Menu bên');--> statement-breakpoint
INSERT INTO `menu_item` (`id`, `menu_id`, `parent_id`, `position`, `label`, `link_type`, `href`, `icon_type`, `icon_url`) VALUES
('mi-gioi-thieu', 'header', NULL, 1, 'Giới thiệu', 'url', '/gioi-thieu', 'none', ''),
('mi-lich-su', 'header', 'mi-gioi-thieu', 1, 'Lịch sử Bổn tự', 'url', '/gioi-thieu/lich-su-tung-lam-hoa-phuc', 'image', '/brand/logo-tung-lam-hoa-phuc-tron-nga.webp'),
('mi-chu-ton-duc', 'header', 'mi-gioi-thieu', 2, 'Chư Tôn Đức', 'url', '/gioi-thieu#nguoi-lien-quan', 'none', ''),
('mi-thanh-quy', 'header', 'mi-gioi-thieu', 3, 'Thanh quy', 'url', '/gioi-thieu/van-hoa-ung-xu', 'none', ''),
('mi-vu-tru', 'header', 'mi-gioi-thieu', 4, 'Vũ Trụ Phật Giáo', 'url', '/vu-tru-phat-giao', 'image', '/brand/icons/icon-cac-khu-vuc-noi-bat.webp'),
('mi-bao-tuong', 'header', 'mi-gioi-thieu', 5, 'Bảo Tượng Phật Giáo', 'url', '/bao-tuong-phat-giao', 'image', '/brand/icons/icon-cac-bao-tuong-noi-bat.webp'),
('mi-tin-tuc', 'header', NULL, 2, 'Tin tức – Pháp thoại', 'url', '/dong-chay-hoang-phap', 'none', ''),
('mi-dong-chay', 'header', 'mi-tin-tuc', 1, 'Dòng Chảy Hoằng Pháp', 'url', '/dong-chay-hoang-phap', 'image', '/brand/icons/icon-dong-chay-hoang-phap.webp'),
('mi-tong-chi', 'header', 'mi-tin-tuc', 2, 'Tông Chỉ Tu Học', 'url', '/tong-chi-tu-hoc', 'image', '/brand/icons/icon-tong-chi-tu-hoc.webp'),
('mi-tri-tue', 'header', 'mi-tin-tuc', 3, 'Trí Tuệ Phật Pháp', 'url', '/tri-tue-phat-phap', 'image', '/brand/icons/icon-tri-tue-phat-phap.webp'),
('mi-lich-tu-hoc', 'header', NULL, 3, 'Lịch tu học', 'url', '/lich-tu-hoc', 'none', ''),
('mi-lien-he', 'header', NULL, 4, 'Liên hệ', 'url', '/lien-he', 'none', '');
