export interface AdminAccount {
  id: string;
  username: string;
}

export type AdminEnv = {
  Variables: { admin: AdminAccount };
};
