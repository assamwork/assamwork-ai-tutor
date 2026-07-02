export function isAdmin(user) {
  const email = user?.email?.trim().toLowerCase();

  if (!email) return false;

  const allowedEmails = (import.meta.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((allowedEmail) => allowedEmail.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(email);
}
