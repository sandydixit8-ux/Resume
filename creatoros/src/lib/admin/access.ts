export function isPlatformAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
}