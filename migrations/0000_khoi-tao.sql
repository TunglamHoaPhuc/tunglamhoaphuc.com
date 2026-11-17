CREATE TABLE `album` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `album_item` (
	`album_id` text NOT NULL,
	`position` integer NOT NULL,
	`media_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`album_id`, `position`),
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `area` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`temple` text DEFAULT '' NOT NULL,
	`cover_media_id` text,
	`cover_position` text DEFAULT 'center 50%' NOT NULL,
	`map_x` real,
	`map_y` real,
	`intro` text DEFAULT '' NOT NULL,
	`content_html` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `area_slug_unique` ON `area` (`slug`);--> statement-breakpoint
CREATE TABLE `art_variation` (
	`id` text PRIMARY KEY NOT NULL,
	`statue_id` text NOT NULL,
	`position` integer NOT NULL,
	`variation_id` text DEFAULT '' NOT NULL,
	`art_statue_id` text,
	`title` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`image_media_id` text,
	`image_position` text DEFAULT 'center 50%' NOT NULL,
	FOREIGN KEY (`statue_id`) REFERENCES `statue`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`art_statue_id`) REFERENCES `statue`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `art_statue` ON `art_variation` (`statue_id`,`position`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`diff` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_entity` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_time` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `calendar_event` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`category_id` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`times` text DEFAULT '[]' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`image_media_id` text,
	`image_position` text DEFAULT 'center 50%' NOT NULL,
	`video` text,
	`position` integer DEFAULT 0 NOT NULL,
	`recurrence_rule` text,
	`linked_post_id` text,
	`registration_open` integer DEFAULT false NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_dates` ON `calendar_event` (`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`section` text DEFAULT '' NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`color_token` text
);
--> statement-breakpoint
CREATE INDEX `category_kind` ON `category` (`kind`,`section`);--> statement-breakpoint
CREATE TABLE `featured_program` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`duration` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`image_media_id` text,
	`image_position` text DEFAULT 'center 50%' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`image_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text,
	`url` text,
	`folder` text DEFAULT '' NOT NULL,
	`filename` text DEFAULT '' NOT NULL,
	`mime` text,
	`width` integer,
	`height` integer,
	`size_bytes` integer,
	`alt` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`uploaded_by` text,
	`created_at` text,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "media_has_place" CHECK("media"."r2_key" is not null or "media"."url" is not null)
);
--> statement-breakpoint
CREATE INDEX `media_r2_key` ON `media` (`r2_key`);--> statement-breakpoint
CREATE TABLE `milestone` (
	`page_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`page_id`, `position`),
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monk` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`lifespan` text DEFAULT '' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`sangha` text DEFAULT '' NOT NULL,
	`sect` text DEFAULT '' NOT NULL,
	`era` text DEFAULT '' NOT NULL,
	`sub_era` text DEFAULT '' NOT NULL,
	`avatar_media_id` text,
	`dharma_quote` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`coord_x` real,
	`coord_y` real,
	`position` integer DEFAULT 0 NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`avatar_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `monk_filters` ON `monk` (`region`,`sangha`);--> statement-breakpoint
CREATE TABLE `month_theme` (
	`month` integer PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`poster_media_id` text,
	`lines` text DEFAULT '[]' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`poster_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notice` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`version` text DEFAULT 'v1.0.0' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`show_once` integer DEFAULT false NOT NULL,
	`expires_on` text
);
--> statement-breakpoint
CREATE TABLE `page` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`kicker` text DEFAULT '' NOT NULL,
	`group_id` text,
	`banner_media_id` text,
	`banner_position` text DEFAULT 'center 50%' NOT NULL,
	`portrait_media_id` text,
	`portrait_position` text DEFAULT 'center 50%' NOT NULL,
	`overview` text DEFAULT '' NOT NULL,
	`quote` text,
	`content_html` text DEFAULT '' NOT NULL,
	`book` text,
	`album_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`banner_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`portrait_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_slug_unique` ON `page` (`slug`);--> statement-breakpoint
CREATE INDEX `page_group` ON `page` (`group_id`,`position`);--> statement-breakpoint
CREATE TABLE `page_view` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`, `date`)
);
--> statement-breakpoint
CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`section` text NOT NULL,
	`category_id` text,
	`author` text DEFAULT '' NOT NULL,
	`published_date` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`legacy_views` integer DEFAULT 0 NOT NULL,
	`thumbnail_media_id` text,
	`thumbnail_position` text DEFAULT 'center 50%' NOT NULL,
	`banner_media_id` text,
	`banner_position` text DEFAULT 'center 50%' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`intro` text DEFAULT '' NOT NULL,
	`content_html` text DEFAULT '' NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`videos` text DEFAULT '[]' NOT NULL,
	`album_id` text,
	`gallery_count` integer DEFAULT 0 NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`thumbnail_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`banner_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_slug` ON `post` (`slug`);--> statement-breakpoint
CREATE INDEX `post_section_date` ON `post` (`section`,`published_date`);--> statement-breakpoint
CREATE INDEX `post_category` ON `post` (`category_id`);--> statement-breakpoint
CREATE TABLE `quote_image` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`media_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `redirect` (
	`from_path` text PRIMARY KEY NOT NULL,
	`to_path` text NOT NULL,
	`code` integer DEFAULT 301 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `registration` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`event_id` text NOT NULL,
	`full_name` text NOT NULL,
	`dharma_name` text DEFAULT '' NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`participants` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `calendar_event`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registration_code_unique` ON `registration` (`code`);--> statement-breakpoint
CREATE INDEX `registration_event` ON `registration` (`event_id`,`status`);--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statue` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`area_id` text,
	`area_code` text DEFAULT '' NOT NULL,
	`cluster_id` text,
	`assembly_id` text,
	`is_main` integer DEFAULT false NOT NULL,
	`image_media_id` text,
	`image_position` text DEFAULT 'center 50%' NOT NULL,
	`quote_text` text,
	`quote_author` text,
	`body` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`area_id`) REFERENCES `area`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cluster_id`) REFERENCES `statue_cluster`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assembly_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statue_slug_unique` ON `statue` (`slug`);--> statement-breakpoint
CREATE INDEX `statue_area` ON `statue` (`area_id`,`position`);--> statement-breakpoint
CREATE INDEX `statue_code` ON `statue` (`code`);--> statement-breakpoint
CREATE TABLE `statue_cluster` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`assembly_id` text,
	`area_id` text,
	`description` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`assembly_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `area`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cluster_area` ON `statue_cluster` (`area_id`);--> statement-breakpoint
CREATE TABLE `teaching_article` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`group_id` text,
	`banner_media_id` text,
	`banner_position` text DEFAULT 'center 50%' NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`author_href` text,
	`published_date` text DEFAULT '' NOT NULL,
	`legacy_views` integer DEFAULT 0 NOT NULL,
	`video` text,
	`featured` text,
	`book` text,
	`keywords` text DEFAULT '[]' NOT NULL,
	`album_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`banner_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teaching_article_slug_unique` ON `teaching_article` (`slug`);--> statement-breakpoint
CREATE INDEX `teaching_group` ON `teaching_article` (`group_id`,`position`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);