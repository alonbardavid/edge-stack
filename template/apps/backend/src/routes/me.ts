import { api } from "./api";

export const me = api.me.handler(({ context }) => context.requestContext.user);
