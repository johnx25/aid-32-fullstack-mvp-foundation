export type ApiResult<T> = { success: boolean; data?: T; error?: { code: string; message: string } };

export type RegisterResponseData = {
  userId: number;
  email: string;
  displayName: string;
  secret: string;
  authTokenExpiresAt: string;
  redirectTo: string;
};

export function normalizeEmailInput(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeRegisterInput(input: {
  email: string;
  name: string;
  bio: string;
  city: string;
  interests: string;
  inviteCode: string;
}) {
  return {
    email: normalizeEmailInput(input.email),
    displayName: input.name.trim(),
    bio: input.bio.trim(),
    city: input.city.trim(),
    interests: input.interests.trim(),
    inviteCode: input.inviteCode.trim(),
  };
}

export function isValidRegisterResponseData(data: unknown): data is RegisterResponseData {
  if (!data || typeof data !== "object") return false;
  const value = data as Partial<RegisterResponseData>;
  const authTokenExpiresAt =
    typeof value.authTokenExpiresAt === "string" ? Date.parse(value.authTokenExpiresAt) : Number.NaN;
  return (
    typeof value.userId === "number" &&
    Number.isFinite(value.userId) &&
    value.userId > 0 &&
    typeof value.email === "string" &&
    value.email.length > 0 &&
    typeof value.displayName === "string" &&
    value.displayName.length > 0 &&
    typeof value.secret === "string" &&
    value.secret.trim().length > 0 &&
    Number.isFinite(authTokenExpiresAt) &&
    typeof value.redirectTo === "string" &&
    value.redirectTo.length > 0
  );
}

export function mapErrorMessage(error: ApiResult<unknown>["error"], fallback: string) {
  if (!error) return fallback;
  if (error.code === "CONFLICT") return "That email is already registered.";
  if (error.code === "FORBIDDEN") return "A valid invite code is required right now.";
  if (error.code === "TOO_MANY_REQUESTS") return "Too many attempts. Please wait and try again.";
  return error.message || fallback;
}
