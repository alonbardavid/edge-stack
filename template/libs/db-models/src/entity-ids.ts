import { nanoid } from "nanoid";

export const ENTITY_PREFIXES = {
  USER: "U",
  USER_SESSION: "US",
  USER_ACCOUNT: "UA",
  USER_VERIFICATION: "UV",
  ADMIN: "ADM",
  ADMIN_SESSION: "AS",
} as const satisfies Record<string, Uppercase<string>>;

export type Entity = keyof typeof ENTITY_PREFIXES;

// These ids reach URLs and support conversations, so they are short.
const USER_VISIBLE_ID_ENTITIES: ReadonlySet<Entity> = new Set([
  "USER",
  "ADMIN",
]);

export function newEntityId(entity: Entity): string {
  const unique = USER_VISIBLE_ID_ENTITIES.has(entity)
    ? nanoid()
    : crypto.randomUUID();
  return `${ENTITY_PREFIXES[entity]}_${unique}`;
}
