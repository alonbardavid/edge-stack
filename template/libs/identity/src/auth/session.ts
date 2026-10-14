import type { RequestContext } from "./request-context";
import { getAuth } from "../auth";

export async function resolveRequestContext(
  headers: Headers,
): Promise<RequestContext | null> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
    },
    session: { id: session.session.id },
  };
}
