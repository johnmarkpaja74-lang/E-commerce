import * as SQLite from 'expo-sqlite';

export type AppDatabase = SQLite.SQLiteDatabase;

let database: AppDatabase | null = null;

export function getDatabase(): AppDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync('commerce.db');
  }

  return database;
}
