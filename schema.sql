CREATE TABLE IF NOT EXISTS command_usage (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	command_name VARCHAR(128) NOT NULL,
	user_id VARCHAR(32) NOT NULL,
	guild_id VARCHAR(32) DEFAULT NULL,
	success TINYINT(1) NOT NULL DEFAULT 1,
	error_message TEXT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_created_at (created_at),
	KEY idx_command_name (command_name),
	KEY idx_guild_id (guild_id),
	KEY idx_user_id (user_id),
	KEY idx_success (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;