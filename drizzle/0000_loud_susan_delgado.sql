CREATE TABLE `lead_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`run_id` text,
	`engine` text DEFAULT 'reacher' NOT NULL,
	`verification_status` text NOT NULL,
	`risk_level` text NOT NULL,
	`reason` text NOT NULL,
	`technical_failure` integer DEFAULT false NOT NULL,
	`details` text,
	`verified_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `verification_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `lead_verifications_lead_id_idx` ON `lead_verifications` (`lead_id`);--> statement-breakpoint
CREATE INDEX `lead_verifications_run_id_idx` ON `lead_verifications` (`run_id`);--> statement-breakpoint
CREATE INDEX `lead_verifications_verified_at_idx` ON `lead_verifications` (`verified_at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`first_upload_id` text,
	`original_email` text NOT NULL,
	`normalized_email` text NOT NULL,
	`domain` text NOT NULL,
	`mapped_fields` text,
	`latest_verification_status` text,
	`latest_risk_level` text,
	`latest_reason` text,
	`latest_verified_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`first_upload_id`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_normalized_email_idx` ON `leads` (`normalized_email`);--> statement-breakpoint
CREATE INDEX `leads_domain_idx` ON `leads` (`domain`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`latest_verification_status`);--> statement-breakpoint
CREATE INDEX `leads_risk_idx` ON `leads` (`latest_risk_level`);--> statement-breakpoint
CREATE TABLE `upload_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_id` text NOT NULL,
	`row_index` integer NOT NULL,
	`original_email` text,
	`normalized_email` text,
	`payload` text,
	`status` text NOT NULL,
	`rejection_reason` text,
	`lead_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`upload_id`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_rows_upload_row_idx` ON `upload_rows` (`upload_id`,`row_index`);--> statement-breakpoint
CREATE INDEX `upload_rows_upload_id_idx` ON `upload_rows` (`upload_id`);--> statement-breakpoint
CREATE INDEX `upload_rows_lead_id_idx` ON `upload_rows` (`lead_id`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`email_column` text,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`accepted_rows` integer DEFAULT 0 NOT NULL,
	`rejected_rows` integer DEFAULT 0 NOT NULL,
	`import_summary` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `uploads_created_by_user_id_idx` ON `uploads` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `uploads_created_at_idx` ON `uploads` (`created_at`);--> statement-breakpoint
CREATE TABLE `verification_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source` text DEFAULT 'filter' NOT NULL,
	`filter_snapshot` text,
	`total_leads` integer DEFAULT 0 NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`valid_count` integer DEFAULT 0 NOT NULL,
	`risky_count` integer DEFAULT 0 NOT NULL,
	`invalid_count` integer DEFAULT 0 NOT NULL,
	`unknown_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`heartbeat_at` integer,
	`error_message` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `verification_runs_created_by_user_id_idx` ON `verification_runs` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `verification_runs_status_idx` ON `verification_runs` (`status`);--> statement-breakpoint
CREATE INDEX `verification_runs_created_at_idx` ON `verification_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);