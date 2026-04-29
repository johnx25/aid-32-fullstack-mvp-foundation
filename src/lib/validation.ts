const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DEFAULT_AVATAR_URL = "/avatars/default.svg";

function stripControlChars(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}

export function sanitizeUserText(value: string, maxLength: number) {
  const cleaned = stripControlChars(value).replace(/[<>]/g, "").trim();
  return cleaned.slice(0, maxLength);
}

export function normalizeEmail(value: string) {
  return stripControlChars(value).trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return EMAIL_RE.test(value) && value.length <= 254;
}

export function validatePositiveInt(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function hasMinimumProfileQuality(profile: { bio: string; avatarUrl: string }) {
  return profile.bio.trim().length > 0 && profile.avatarUrl.trim().length > 0;
}
