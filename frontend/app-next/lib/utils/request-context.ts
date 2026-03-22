import { cookies } from "next/headers";

import { CURRENT_USER_SESSION_COOKIE_NAME } from "@/lib/utils/current-user-session";

export function readCurrentUserCookieFromRequest(): string | undefined {
  try {
    return cookies().get(CURRENT_USER_SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}
