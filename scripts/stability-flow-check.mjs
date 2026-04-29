const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3200";
const cookieJar = new Map();

function persistCookiesFrom(response) {
  const setCookieHeaders = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];

  for (const header of setCookieHeaders) {
    const firstPart = header.split(";")[0];
    if (!firstPart) continue;
    const splitIndex = firstPart.indexOf("=");
    if (splitIndex <= 0) continue;
    const name = firstPart.slice(0, splitIndex).trim();
    const value = firstPart.slice(splitIndex + 1).trim();
    if (!name) continue;
    cookieJar.set(name, value);
  }
}

function buildCookieHeader() {
  if (cookieJar.size === 0) return "";
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function call(path, options = {}) {
  const cookieHeader = buildCookieHeader();
  const mergedHeaders = {
    "content-type": "application/json",
    ...(options.headers || {}),
  };
  if (cookieHeader && !mergedHeaders.cookie) {
    mergedHeaders.cookie = cookieHeader;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: mergedHeaders,
  });
  persistCookiesFrom(response);

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!body || !Object.prototype.hasOwnProperty.call(body, "data") || !Object.prototype.hasOwnProperty.call(body, "error")) {
    throw new Error(`Inconsistent response structure for ${path}: ${JSON.stringify(body)}`);
  }

  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const aEmail = `stability-a-${Date.now()}@example.com`;
  const bEmail = `stability-b-${Date.now()}@example.com`;

  const regA = await call("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: aEmail, displayName: "Flow A", bio: "A", city: "A", interests: "A" }),
  });
  assert(regA.status === 201, "register A failed");
  assert(regA.body.data.secret, "register A did not return secret");

  const regB = await call("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: bEmail, displayName: "Flow B", bio: "B", city: "B", interests: "B" }),
  });
  assert(regB.status === 201, "register B failed");
  assert(regB.body.data.secret, "register B did not return secret");

  const dup = await call("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: aEmail, displayName: "Dup" }),
  });
  assert(dup.status === 409, "duplicate registration should return 409");

  const badLogin = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: aEmail, secret: "wrong-secret" }),
  });
  assert(badLogin.status === 401, "wrong-secret login should return 401");

  const loginA = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: aEmail, secret: regA.body.data.secret }),
  });
  assert(loginA.status === 200, "login A failed");

  const loginB = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: bEmail, secret: regB.body.data.secret }),
  });
  assert(loginB.status === 200, "login B failed");

  const unauthorizedProfileNoCookie = await call("/api/profile", {
    headers: { cookie: "" },
  });
  assert(unauthorizedProfileNoCookie.status === 401, "missing token should return 401");

  const loginAWithToken = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: aEmail, secret: regA.body.data.secret }),
  });
  assert(loginAWithToken.status === 200, "second login A failed");
  const authCookieName = "aid32_auth_token";
  const authToken = cookieJar.get(authCookieName);
  assert(authToken, `login A did not set ${authCookieName} cookie`);

  const loginBWithToken = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: bEmail, secret: regB.body.data.secret }),
  });
  assert(loginBWithToken.status === 200, "second login B failed");
  const authTokenB = cookieJar.get(authCookieName);
  assert(authTokenB, `login B did not set ${authCookieName} cookie`);

  const profileA = await call("/api/profile", {
    headers: { "x-user-id": String(loginA.body.data.userId), "x-auth-token": authToken },
  });
  assert(profileA.status === 200, "profile A failed");

  const discoveryA = await call("/api/discovery", {
    headers: { "x-user-id": String(loginA.body.data.userId), "x-auth-token": authToken },
  });
  assert(discoveryA.status === 200 && Array.isArray(discoveryA.body.data), "discovery A failed");

  const targetProfile = discoveryA.body.data.find((p) => p.userId === loginB.body.data.userId);
  assert(targetProfile, "user B not found in user A discovery");

  const likeA = await call("/api/likes", {
    method: "POST",
    headers: { "x-user-id": String(loginA.body.data.userId), "x-auth-token": authToken },
    body: JSON.stringify({ targetProfileId: targetProfile.profileId }),
  });
  assert(likeA.status === 201, "like A->B failed");

  const discoveryB = await call("/api/discovery", {
    headers: { "x-user-id": String(loginB.body.data.userId), "x-auth-token": authTokenB },
  });
  const targetProfileB = discoveryB.body.data.find((p) => p.userId === loginA.body.data.userId);
  assert(targetProfileB, "user A not found in user B discovery");

  const likeB = await call("/api/likes", {
    method: "POST",
    headers: { "x-user-id": String(loginB.body.data.userId), "x-auth-token": authTokenB },
    body: JSON.stringify({ targetProfileId: targetProfileB.profileId }),
  });
  assert(likeB.status === 201 && likeB.body.data.isMatch === true, "reciprocal like should create match");

  const matchesA = await call("/api/matches", {
    headers: { "x-user-id": String(loginA.body.data.userId), "x-auth-token": authToken },
  });
  assert(matchesA.status === 200 && matchesA.body.data.length > 0, "matches for A missing");
  const matchId = matchesA.body.data[0].matchId;

  const createMessage = await call(`/api/chats/${matchId}`, {
    method: "POST",
    headers: { "x-user-id": String(loginA.body.data.userId), "x-auth-token": authToken },
    body: JSON.stringify({ content: "hello from flow" }),
  });
  assert(createMessage.status === 201, "chat message create failed");

  const chats = await call(`/api/chats/${matchId}`, {
    headers: { "x-user-id": String(loginB.body.data.userId), "x-auth-token": authTokenB },
  });
  assert(chats.status === 200 && chats.body.data.length > 0, "chat fetch failed");

  console.log("Stability flow check passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
