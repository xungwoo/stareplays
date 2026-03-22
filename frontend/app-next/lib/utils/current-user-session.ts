export const CURRENT_USER_SESSION_COOKIE_NAME = "current_user";

export function serializeCurrentUserSession(currentUser: string): string {
  return encodeURIComponent(currentUser.trim());
}

export function buildCurrentUserSessionCookie(currentUser: string): string {
  return `${CURRENT_USER_SESSION_COOKIE_NAME}=${serializeCurrentUserSession(currentUser)}`;
}

export function clearCurrentUserSessionCookie(): string {
  return `${CURRENT_USER_SESSION_COOKIE_NAME}=`;
}

export function buildCurrentUserSessionDocumentCookie(currentUser: string): string {
  return `${buildCurrentUserSessionCookie(currentUser)}; Path=/`;
}

export function clearCurrentUserSessionDocumentCookie(): string {
  return `${clearCurrentUserSessionCookie()}; Path=/`;
}

export function deserializeCurrentUserSession(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

export function parseCurrentUserSessionCookie(cookieHeader?: string | null): string | null {
  if (!cookieHeader?.trim()) {
    return null;
  }

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CURRENT_USER_SESSION_COOKIE_NAME}=`));

  if (!cookie) {
    return null;
  }

  return deserializeCurrentUserSession(cookie.slice(CURRENT_USER_SESSION_COOKIE_NAME.length + 1));
}
