CREATE TABLE `auth_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`locked_until` text
);
--> statement-breakpoint
CREATE TABLE `password_reset` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`requested_ip` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_token_hash_unique` ON `password_reset` (`token_hash`);--> statement-breakpoint
CREATE INDEX `password_reset_user` ON `password_reset` (`user_id`);--> statement-breakpoint
CREATE TABLE `role` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` text,
	`updated_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_name_unique` ON `role` (`name`);--> statement-breakpoint
CREATE TABLE `role_permission` (
	`role_id` text NOT NULL,
	`module` text NOT NULL,
	`action` text NOT NULL,
	`scope` text DEFAULT 'all' NOT NULL,
	PRIMARY KEY(`role_id`, `module`, `action`),
	FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`refresh_hash` text,
	`prev_refresh_hash` text,
	`rotated_at` text,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`ip` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`mfa_passed` integer DEFAULT false NOT NULL,
	`mfa_failures` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_refresh_hash_unique` ON `session` (`refresh_hash`);--> statement-breakpoint
CREATE INDEX `session_user` ON `session` (`user_id`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `user_totp` (
	`user_id` text PRIMARY KEY NOT NULL,
	`secret_enc` text NOT NULL,
	`enabled_at` text,
	`recovery_hashes` text DEFAULT '[]' NOT NULL,
	`last_used_step` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `user` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `user` ADD `password_changed_at` text;--> statement-breakpoint
ALTER TABLE `user` ADD `must_change_password` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `role_id` text REFERENCES role(id);--> statement-breakpoint
ALTER TABLE `user` ADD `locked_at` text;--> statement-breakpoint
ALTER TABLE `user` ADD `locked_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `failed_logins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `avatar_media_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `user` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `user` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `user` ADD `deleted_by` text;