import { getDatabase } from '@/src/services/storage/sqlite/db';
import type { AuthSession } from '@/src/features/auth/model/types';

type AuthSessionRow = {
  user_id: string;
  email: string;
  auth_token: string;
  created_at: number;
};

export function loadAuthSessionFromStorage(): AuthSession | null {
  const database = getDatabase();
  const row = database.getFirstSync<AuthSessionRow>(
    'SELECT user_id, email, auth_token, created_at FROM auth_session WHERE id = 1;'
  );

  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    email: row.email,
    authToken: row.auth_token,
    createdAt: row.created_at,
  };
}

export function saveAuthSessionToStorage(session: AuthSession): void {
  const database = getDatabase();
  database.runSync(
    `
      INSERT INTO auth_session (id, user_id, email, auth_token, created_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id)
      DO UPDATE SET
        user_id = excluded.user_id,
        email = excluded.email,
        auth_token = excluded.auth_token,
        created_at = excluded.created_at;
    `,
    [session.userId, session.email, session.authToken, session.createdAt]
  );
}

export function clearAuthSessionFromStorage(): void {
  const database = getDatabase();
  database.runSync('DELETE FROM auth_session WHERE id = 1;');
}
