import type { LoginInput, RegisterInput, AuthSession } from '@/src/features/auth/model/types';

function generateToken(): string {
  return `session_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export async function loginWithEmailPassword(input: LoginInput): Promise<AuthSession> {
  const email = input.email.trim().toLowerCase();

  // Demo backend validation rules for local development.
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  if (input.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  return {
    userId: `user_${email}`,
    email,
    authToken: generateToken(),
    createdAt: Date.now(),
  };
}

export async function registerWithEmailPassword(input: RegisterInput): Promise<AuthSession> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || email.split('@')[0];

  // Demo backend validation rules for local development.
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  if (input.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  if (!input.displayName?.trim()) {
    throw new Error('Display name is required.');
  }

  return {
    userId: `user_${email}`,
    email,
    displayName,
    authToken: generateToken(),
    createdAt: Date.now(),
  };
}
