ALTER TABLE `audit_log` ADD `user_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `data_before` text;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `data_after` text;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `ip` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `user_agent` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `request_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `audit_user_time` ON `audit_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_action_time` ON `audit_log` (`action`,`created_at`);--> statement-breakpoint
-- The activity log is append-only: nothing may change or delete a row (docs/admin-architecture.md 5.5).
-- Added by hand: drizzle-kit does not generate triggers.
CREATE TRIGGER `audit_log_no_update` BEFORE UPDATE ON `audit_log` BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `audit_log_no_delete` BEFORE DELETE ON `audit_log` BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;