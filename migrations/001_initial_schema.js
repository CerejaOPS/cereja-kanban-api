/**
 * @type {import('node-pg-migrate').MigrationBuilder}
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE discord_users (
      id VARCHAR(255) PRIMARY KEY,
      display_name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      avatar_url TEXT,
      discord_role VARCHAR(255),
      access_level VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE boards (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      color VARCHAR(50),
      icon VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      owner_discord_id VARCHAR(255) REFERENCES discord_users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE phases (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      position INTEGER DEFAULT 0,
      color VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE labels (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(50) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      phase VARCHAR(255) REFERENCES phases(id) DEFAULT 'todo',
      board_id INTEGER REFERENCES boards(id) DEFAULT 1,
      priority VARCHAR(50) DEFAULT 'medium',
      story_points INTEGER,
      due_date TIMESTAMP,
      
      assignee_discord_id VARCHAR(255) REFERENCES discord_users(id) ON DELETE SET NULL,
      assignee_name VARCHAR(255),
      assignee_email VARCHAR(255),
      
      discord_thread_id VARCHAR(255),
      time_spent DOUBLE PRECISION DEFAULT 0,
      
      active_owner_discord_id VARCHAR(255) REFERENCES discord_users(id) ON DELETE SET NULL,
      active_owner_name VARCHAR(255),
      active_owner_avatar_url TEXT,
      active_owner_started_at TIMESTAMP,
      
      is_archived BOOLEAN DEFAULT false,
      
      last_edited_by_name VARCHAR(255),
      last_edited_by_discord_id VARCHAR(255),
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE task_labels (
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      label_id INTEGER REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, label_id)
    );

    CREATE TABLE task_checklists (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      is_completed BOOLEAN DEFAULT false,
      status VARCHAR(50) DEFAULT 'todo',
      position INTEGER DEFAULT 0,
      
      assignee_discord_id VARCHAR(255) REFERENCES discord_users(id) ON DELETE SET NULL,
      assignee_name VARCHAR(255),
      
      completed_at TIMESTAMP,
      completed_by VARCHAR(255),
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE checklist_activities (
      id SERIAL PRIMARY KEY,
      checklist_id INTEGER REFERENCES task_checklists(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      action VARCHAR(255) NOT NULL,
      actor_name VARCHAR(255),
      actor_discord_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE checklist_comments (
      id SERIAL PRIMARY KEY,
      checklist_id INTEGER REFERENCES task_checklists(id) ON DELETE CASCADE,
      author_name VARCHAR(255),
      author_discord_id VARCHAR(255),
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE comments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      author_name VARCHAR(255),
      author_discord_id VARCHAR(255),
      is_pinned BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP,
      deleted_by_name VARCHAR(255),
      edited_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE activity_logs (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      action VARCHAR(255) NOT NULL,
      phase VARCHAR(255),
      from_phase VARCHAR(255),
      to_phase VARCHAR(255),
      details TEXT,
      actor_name VARCHAR(255),
      actor_discord_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE task_time_entries (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      phase VARCHAR(255),
      minutes DOUBLE PRECISION NOT NULL,
      source VARCHAR(50),
      note TEXT,
      actor_name VARCHAR(255),
      actor_discord_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE task_observations (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      phase VARCHAR(255),
      time_spent_minutes DOUBLE PRECISION DEFAULT 0,
      author_name VARCHAR(255),
      author_discord_id VARCHAR(255),
      deleted_at TIMESTAMP,
      deleted_by_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE board_fields (
      id SERIAL PRIMARY KEY,
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      options TEXT,
      required BOOLEAN DEFAULT false,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE task_field_values (
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      field_id INTEGER REFERENCES board_fields(id) ON DELETE CASCADE,
      value TEXT,
      PRIMARY KEY (task_id, field_id)
    );

    CREATE TABLE phase_rules (
      id SERIAL PRIMARY KEY,
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      phase_id VARCHAR(255) REFERENCES phases(id) ON DELETE CASCADE,
      require_assignee BOOLEAN DEFAULT false,
      require_checklist_done BOOLEAN DEFAULT false,
      require_custom_fields TEXT,
      UNIQUE(board_id, phase_id)
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS phase_rules CASCADE;
    DROP TABLE IF EXISTS task_field_values CASCADE;
    DROP TABLE IF EXISTS board_fields CASCADE;
    DROP TABLE IF EXISTS task_observations CASCADE;
    DROP TABLE IF EXISTS task_time_entries CASCADE;
    DROP TABLE IF EXISTS activity_logs CASCADE;
    DROP TABLE IF EXISTS comments CASCADE;
    DROP TABLE IF EXISTS checklist_comments CASCADE;
    DROP TABLE IF EXISTS checklist_activities CASCADE;
    DROP TABLE IF EXISTS task_checklists CASCADE;
    DROP TABLE IF EXISTS task_labels CASCADE;
    DROP TABLE IF EXISTS tasks CASCADE;
    DROP TABLE IF EXISTS labels CASCADE;
    DROP TABLE IF EXISTS phases CASCADE;
    DROP TABLE IF EXISTS boards CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS discord_users CASCADE;
  `);
};
