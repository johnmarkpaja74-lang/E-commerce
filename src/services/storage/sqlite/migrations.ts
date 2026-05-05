import { getDatabase } from '@/src/services/storage/sqlite/db';

export function runMigrations(): void {
  const database = getDatabase();

  database.execSync(`
    CREATE TABLE IF NOT EXISTS cart_items (
      product_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS cart_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS auth_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      auth_token TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profile_preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      display_name TEXT,
      avatar_url TEXT,
      hero_background_url TEXT
    );

    CREATE TABLE IF NOT EXISTS profile_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      address TEXT NOT NULL DEFAULT '123 Main Street, New York, USA',
      notifications_enabled INTEGER NOT NULL DEFAULT 1,
      trusted_device INTEGER NOT NULL DEFAULT 1,
      language TEXT NOT NULL DEFAULT 'English',
      last_password_update TEXT
    );
  `);

  try {
    database.runSync('ALTER TABLE profile_preferences ADD COLUMN hero_background_url TEXT;');
  } catch {
    // Column already exists.
  }

  try {
    database.runSync('ALTER TABLE cart_items ADD COLUMN image_url TEXT;');
  } catch {
    // Column already exists.
  }

  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_cart_operations_synced_timestamp
    ON cart_operations(synced, timestamp);
  `);
}
