import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidRegisterResponseData,
  mapErrorMessage,
  normalizeEmailInput,
  normalizeRegisterInput,
} from "./register-page.logic";

test("normalizeEmailInput trims and lowercases", () => {
  assert.equal(normalizeEmailInput("  USER@Example.COM "), "user@example.com");
});

test("normalizeRegisterInput trims all register fields", () => {
  const normalized = normalizeRegisterInput({
    email: "  USER@Example.COM ",
    name: "  Alex  ",
    bio: "  Bio  ",
    city: "  Berlin ",
    interests: " hiking, coffee  ",
    inviteCode: "  INVITE-1 ",
  });

  assert.deepEqual(normalized, {
    email: "user@example.com",
    displayName: "Alex",
    bio: "Bio",
    city: "Berlin",
    interests: "hiking, coffee",
    inviteCode: "INVITE-1",
  });
});

test("isValidRegisterResponseData accepts valid payload", () => {
  assert.equal(
    isValidRegisterResponseData({
      userId: 1,
      email: "user@example.com",
      displayName: "Alex",
      secret: "secret-token",
      authTokenExpiresAt: "2026-04-29T19:00:00.000Z",
      redirectTo: "/",
    }),
    true,
  );
});

test("isValidRegisterResponseData rejects invalid payloads", () => {
  assert.equal(isValidRegisterResponseData(null), false);
  assert.equal(isValidRegisterResponseData({}), false);
  assert.equal(
    isValidRegisterResponseData({
      userId: 0,
      email: "user@example.com",
      displayName: "Alex",
      secret: "secret-token",
      authTokenExpiresAt: "2026-04-29T19:00:00.000Z",
      redirectTo: "/",
    }),
    false,
  );
  assert.equal(
    isValidRegisterResponseData({
      userId: 1,
      email: "",
      displayName: "Alex",
      secret: "secret-token",
      authTokenExpiresAt: "2026-04-29T19:00:00.000Z",
      redirectTo: "/",
    }),
    false,
  );
  assert.equal(
    isValidRegisterResponseData({
      userId: 1,
      email: "user@example.com",
      displayName: "Alex",
      secret: "secret-token",
      authTokenExpiresAt: "not-a-date",
      redirectTo: "/",
    }),
    false,
  );
  assert.equal(
    isValidRegisterResponseData({
      userId: 1,
      email: "user@example.com",
      displayName: "Alex",
      secret: "secret-token",
      authTokenExpiresAt: "2026-04-29T19:00:00.000Z",
      redirectTo: "",
    }),
    false,
  );
});

test("mapErrorMessage maps known API codes and falls back for unknown", () => {
  assert.equal(mapErrorMessage({ code: "CONFLICT", message: "x" }, "fallback"), "That email is already registered.");
  assert.equal(
    mapErrorMessage({ code: "FORBIDDEN", message: "x" }, "fallback"),
    "A valid invite code is required right now.",
  );
  assert.equal(
    mapErrorMessage({ code: "TOO_MANY_REQUESTS", message: "x" }, "fallback"),
    "Too many attempts. Please wait and try again.",
  );
  assert.equal(mapErrorMessage({ code: "UNKNOWN", message: "message from server" }, "fallback"), "message from server");
  assert.equal(mapErrorMessage(undefined, "fallback"), "fallback");
});
