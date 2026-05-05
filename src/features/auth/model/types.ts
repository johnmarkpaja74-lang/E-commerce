export type UserSession = {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
};

export type AuthSession = {
  userId: string;
  email: string;
  authToken: string;
  createdAt: number;
  displayName?: string;
};

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}
