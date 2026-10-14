import { hashPassword } from "better-auth/crypto";
import { newEntityId } from "@lib/db-models/entity-ids";

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
}

export interface CreateAdminInput {
  username: string;
  password: string;
}

export async function buildCreateAdminSql({
  username,
  password,
}: CreateAdminInput): Promise<string> {
  if (!username || !password) {
    throw new Error("username and password are both required");
  }
  const adminId = newEntityId("ADMIN");
  const hash = await hashPassword(password);
  return (
    `INSERT INTO app_admin (id, username, password) VALUES ` +
    `(${sqlString(adminId)}, ${sqlString(username)}, ${sqlString(hash)});`
  );
}

export async function buildCreateUserSql({
  email,
  password,
  name,
}: CreateUserInput): Promise<string> {
  if (!email || !password || !name) {
    throw new Error("email, password and name are all required");
  }
  const userId = newEntityId("USER");
  const accountId = newEntityId("USER_ACCOUNT");
  const hash = await hashPassword(password);

  const userInsert =
    `INSERT INTO user (id, name, email, email_verified) VALUES ` +
    `(${sqlString(userId)}, ${sqlString(name)}, ${sqlString(email)}, 1);`;

  const accountInsert =
    `INSERT INTO user_accounts (id, account_id, provider_id, user_id, password) VALUES ` +
    `(${sqlString(accountId)}, ${sqlString(userId)}, 'credential', ${sqlString(userId)}, ${sqlString(hash)});`;

  return `${userInsert}\n${accountInsert}`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
