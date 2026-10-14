import { newEntityId } from "@lib/db-models/entity-ids";
import { hashPassword } from "better-auth/crypto";

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function buildCreateAdminSql({ username, password }) {
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
