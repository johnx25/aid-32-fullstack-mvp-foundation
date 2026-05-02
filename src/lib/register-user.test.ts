import test from "node:test";
import assert from "node:assert/strict";
import { registerUser } from "./register-user";

test("registerUser rejects duplicate email addresses", async () => {
  await assert.rejects(
    registerUser(
      {
        async findUserByEmail() {
          return { id: 1, email: "taken@example.com", displayName: "Taken" };
        },
        async createUser() {
          throw new Error("should not create duplicate user");
        },
        hashPassword(password) {
          return `hashed:${password}`;
        },
      },
      {
        email: "taken@example.com",
        password: "supersecret",
        birthDate: new Date("1990-01-01"),
      },
    ),
    /EMAIL_ALREADY_EXISTS/,
  );
});

test("registerUser hashes the password and persists the user", async () => {
  let createPayload:
    | {
        email: string;
        displayName: string;
        secretHash: string;
        birthDate: Date;
      }
    | undefined;

  const result = await registerUser(
    {
      async findUserByEmail() {
        return null;
      },
      async createUser(data) {
        createPayload = data;
        return { id: 42, email: data.email, displayName: data.displayName };
      },
      hashPassword(password) {
        return `hashed:${password}`;
      },
    },
    {
      email: "new.user@example.com",
      password: "supersecret",
      birthDate: new Date("1992-04-10"),
    },
  );

  assert.deepEqual(createPayload, {
    email: "new.user@example.com",
    displayName: "new user",
    secretHash: "hashed:supersecret",
    birthDate: new Date("1992-04-10"),
  });
  assert.equal(result.userId, 42);
  assert.equal(result.email, "new.user@example.com");
  assert.equal(result.displayName, "new user");
  assert.equal(result.redirectTo, "/profile/setup");
});
