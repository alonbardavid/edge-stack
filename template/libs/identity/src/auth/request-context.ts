export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

export interface RequestContext {
  user: AuthUser;
  session: { id: string };
}
