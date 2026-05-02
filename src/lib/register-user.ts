export type RegisterUserInput = {
  email: string;
  password: string;
  birthDate: Date;
  displayName?: string;
};

export type RegisterUserResult = {
  userId: number;
  email: string;
  displayName: string;
  redirectTo: string;
};

export type RegisterUserDeps<UserRecord extends { id: number; email: string; displayName: string }> = {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(data: {
    email: string;
    displayName: string;
    secretHash: string;
    birthDate: Date;
  }): Promise<UserRecord>;
  hashPassword(password: string): string;
};

export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._\-+]/g, " ").trim().slice(0, 80) || "User";
}

export async function registerUser<UserRecord extends { id: number; email: string; displayName: string }>(
  deps: RegisterUserDeps<UserRecord>,
  input: RegisterUserInput,
): Promise<RegisterUserResult> {
  const existingUser = await deps.findUserByEmail(input.email);
  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const displayName = input.displayName?.trim() || displayNameFromEmail(input.email);
  const secretHash = deps.hashPassword(input.password);

  const user = await deps.createUser({
    email: input.email,
    displayName,
    secretHash,
    birthDate: input.birthDate,
  });

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    redirectTo: "/profile/setup",
  };
}
