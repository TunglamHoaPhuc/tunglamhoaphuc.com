CREATE TABLE `media_crop` (
	`media_id` text NOT NULL,
	`ratio` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`width` real NOT NULL,
	`height` real NOT NULL,
	`r2_key` text NOT NULL,
	`updated_at` text,
	PRIMARY KEY(`media_id`, `ratio`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_folder` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX `media_folder_parent` ON `media_folder` (`parent_id`,`position`);--> statement-breakpoint
CREATE TABLE `media_usage` (
	`media_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	PRIMARY KEY(`media_id`, `entity_type`, `entity_id`, `field`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_usage_entity` ON `media_usage` (`entity_type`,`entity_id`);--> statement-breakpoint
ALTER TABLE `media` ADD `folder_id` text REFERENCES media_folder(id);--> statement-breakpoint
ALTER TABLE `media` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `original_filename` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `checksum` text;--> statement-breakpoint
ALTER TABLE `media` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `media` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `media` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `media` ADD `deleted_by` text;--> statement-breakpoint
CREATE INDEX `media_folder_id` ON `media` (`folder_id`);--> statement-breakpoint
CREATE INDEX `media_created` ON `media` (`created_at`);--> statement-breakpoint
CREATE INDEX `media_deleted` ON `media` (`deleted_at`);--> statement-breakpoint
-- Where each picture is used today: one row per place, read from every column that points at `media`.
-- Added by hand (drizzle-kit does not generate data). Pictures inside article text are not here: they are
-- found by scripts/backfill-admin.ts and kept up to date by the editor when an article is saved.
INSERT OR IGNORE INTO media_usage (media_id, entity_type, entity_id, field)
SELECT thumbnail_media_id, 'post', id, 'thumbnail' FROM post WHERE thumbnail_media_id IS NOT NULL
UNION ALL SELECT banner_media_id, 'post', id, 'banner' FROM post WHERE banner_media_id IS NOT NULL
UNION ALL SELECT banner_media_id, 'teaching_article', id, 'banner' FROM teaching_article WHERE banner_media_id IS NOT NULL
UNION ALL SELECT banner_media_id, 'page', id, 'banner' FROM page WHERE banner_media_id IS NOT NULL
UNION ALL SELECT portrait_media_id, 'page', id, 'portrait' FROM page WHERE portrait_media_id IS NOT NULL
UNION ALL SELECT cover_media_id, 'area', id, 'cover' FROM area WHERE cover_media_id IS NOT NULL
UNION ALL SELECT image_media_id, 'statue', id, 'image' FROM statue WHERE image_media_id IS NOT NULL
UNION ALL SELECT image_media_id, 'art_variation', id, 'image' FROM art_variation WHERE image_media_id IS NOT NULL
UNION ALL SELECT avatar_media_id, 'monk', id, 'avatar' FROM monk WHERE avatar_media_id IS NOT NULL
UNION ALL SELECT image_media_id, 'calendar_event', id, 'image' FROM calendar_event WHERE image_media_id IS NOT NULL
UNION ALL SELECT image_media_id, 'featured_program', id, 'image' FROM featured_program WHERE image_media_id IS NOT NULL
UNION ALL SELECT poster_media_id, 'month_theme', CAST(month AS TEXT), 'poster' FROM month_theme WHERE poster_media_id IS NOT NULL
UNION ALL SELECT media_id, 'quote_image', id, 'image' FROM quote_image
UNION ALL SELECT media_id, 'album', album_id, 'item' FROM album_item;
