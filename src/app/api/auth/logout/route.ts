import { ok } from "@/lib/api-response";
import { AUTH_TOKEN_COOKIE_NAME, getAuthCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = ok({ loggedOut: true });
  response.cookies.set(AUTH_TOKEN_COOKIE_NAME, "", {
    ...getAuthCookieOptions(),
    maxAge: 0,
  });
  return response;
}
