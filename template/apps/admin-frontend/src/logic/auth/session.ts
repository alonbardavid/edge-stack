export interface AdminLoginResult {
  ok: boolean;
  message?: string;
}

export async function adminLogin(
  username: string,
  password: string,
): Promise<AdminLoginResult> {
  const res = await fetch("/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (res.ok) {
    return { ok: true };
  }
  const body = await res.json().catch(() => null);
  return { ok: false, message: body?.message ?? "Login failed" };
}

export async function adminLogout(): Promise<void> {
  await fetch("/api/admin/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}
