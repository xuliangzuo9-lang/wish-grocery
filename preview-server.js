const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const root = __dirname;
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, "data");
const storePath = process.env.STORE_PATH
  ? path.resolve(process.env.STORE_PATH)
  : path.join(dataDir, "site-store.json");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const useSupabase = Boolean(supabaseUrl && supabaseServiceRoleKey);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const protectedPages = new Set(["/index.html", "/goals.html", "/records.html", "/goal-detail.html"]);

function createUserRecord({
  username,
  displayName,
  password,
  role = "user",
  status = "pending",
  note = "",
  approvedBy = null
}) {
  const salt = crypto.randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  return {
    id: `user-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    username,
    displayName,
    passwordHash: hashPassword(password, salt),
    salt,
    role,
    status,
    note,
    createdAt: now,
    approvedAt: status === "approved" ? now : null,
    approvedBy: status === "approved" ? (approvedBy || "system") : null,
    rejectedAt: null,
    rejectedBy: null,
    lastLoginAt: null
  };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function verifyPassword(password, user) {
  return hashPassword(password, user.salt) === user.passwordHash;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, chunk) => {
    const [rawKey, ...rawValue] = chunk.trim().split("=");
    if (!rawKey) {
      return acc;
    }
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  parts.push("SameSite=Lax");
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  const existing = res.getHeader("Set-Cookie");
  const next = Array.isArray(existing) ? existing.concat(parts.join("; ")) : [parts.join("; ")];
  res.setHeader("Set-Cookie", next);
}

function clearCookie(res, name) {
  setCookie(res, name, "", {
    expires: new Date(0),
    maxAge: 0
  });
}

function requireJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    note: user.note,
    createdAt: user.createdAt,
    approvedAt: user.approvedAt,
    approvedBy: user.approvedBy,
    rejectedAt: user.rejectedAt,
    rejectedBy: user.rejectedBy,
    lastLoginAt: user.lastLoginAt
  };
}

function isApprovedUser(user) {
  return Boolean(user && (user.role === "admin" || user.status === "approved"));
}

function isAdmin(user) {
  return Boolean(user && user.role === "admin");
}

function getSafeRelativePath(urlPath) {
  return urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
}

function shouldProtectPage(urlPath) {
  return protectedPages.has(urlPath);
}

function shouldProtectAdmin(urlPath) {
  return urlPath === "/admin.html";
}

function isForbiddenStaticPath(relativePath) {
  return relativePath.startsWith("data/") || relativePath === "preview-server.js";
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    res.end(content);
  });
}

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  for (const values of Object.values(interfaces)) {
    for (const item of values || []) {
      if (item.family === "IPv4" && !item.internal) {
        return item.address;
      }
    }
  }
  return null;
}

function ensureDataStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(storePath)) {
    const seedStore = {
      users: [
        createUserRecord({
          username: "admin",
          displayName: "站长",
          password: "admin123456",
          role: "admin",
          status: "approved",
          note: "默认管理员账号，请尽快修改密码。"
        })
      ],
      sessions: [],
      appStates: {}
    };
    fs.writeFileSync(storePath, JSON.stringify(seedStore, null, 2), "utf8");
  }
}

function readLocalStore() {
  ensureDataStore();
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function writeLocalStore(store) {
  ensureDataStore();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function createLocalStoreAdapter() {
  return {
    async init() {
      ensureDataStore();
    },
    async findUserByUsername(username) {
      const store = readLocalStore();
      return store.users.find((user) => user.username === username) || null;
    },
    async findUserById(id) {
      const store = readLocalStore();
      return store.users.find((user) => user.id === id) || null;
    },
    async listUsers() {
      const store = readLocalStore();
      return store.users.slice();
    },
    async createUser(user) {
      const store = readLocalStore();
      store.users.push(user);
      writeLocalStore(store);
      return user;
    },
    async updateUser(user) {
      const store = readLocalStore();
      const index = store.users.findIndex((item) => item.id === user.id);
      if (index === -1) {
        return null;
      }
      store.users[index] = user;
      writeLocalStore(store);
      return user;
    },
    async findSessionByToken(token) {
      const store = readLocalStore();
      return store.sessions.find((item) => item.token === token) || null;
    },
    async replaceSession(session) {
      const store = readLocalStore();
      store.sessions = store.sessions.filter((item) => item.userId !== session.userId && item.token !== session.token);
      store.sessions.push(session);
      writeLocalStore(store);
      return session;
    },
    async deleteSessionByToken(token) {
      const store = readLocalStore();
      store.sessions = store.sessions.filter((item) => item.token !== token);
      writeLocalStore(store);
    },
    async ensureAdminUser() {
      const store = readLocalStore();
      if (store.users.some((user) => user.role === "admin")) {
        return;
      }
      store.users.push(createUserRecord({
        username: "admin",
        displayName: "站长",
        password: "admin123456",
        role: "admin",
        status: "approved",
        note: "默认管理员账号，请尽快修改密码。"
      }));
      writeLocalStore(store);
    },
    async getAppState(userId) {
      const store = readLocalStore();
      return store.appStates?.[userId] || null;
    },
    async setAppState(userId, appState) {
      const store = readLocalStore();
      store.appStates = store.appStates || {};
      store.appStates[userId] = appState;
      writeLocalStore(store);
      return appState;
    }
  };
}

function userToRow(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.displayName,
    password_hash: user.passwordHash,
    salt: user.salt,
    role: user.role,
    status: user.status,
    note: user.note,
    created_at: user.createdAt,
    approved_at: user.approvedAt,
    approved_by: user.approvedBy,
    rejected_at: user.rejectedAt,
    rejected_by: user.rejectedBy,
    last_login_at: user.lastLoginAt
  };
}

function rowToUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    salt: row.salt,
    role: row.role,
    status: row.status,
    note: row.note || "",
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
    lastLoginAt: row.last_login_at
  };
}

function sessionToRow(session) {
  return {
    token: session.token,
    user_id: session.userId,
    created_at: session.createdAt
  };
}

function appStateToRow(userId, state) {
  return {
    user_id: userId,
    state_json: state,
    updated_at: new Date().toISOString()
  };
}

function rowToAppState(row) {
  if (!row) {
    return null;
  }
  return row.state_json || null;
}

function rowToSession(row) {
  if (!row) {
    return null;
  }
  return {
    token: row.token,
    userId: row.user_id,
    createdAt: row.created_at
  };
}

function createSupabaseStoreAdapter() {
  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

  async function request(tablePath, options = {}) {
    const url = new URL(`${baseUrl}/${tablePath}`);
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value);
        }
      });
    }

    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation",
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error_description || `Supabase request failed: ${response.status}`);
    }
    return payload;
  }

  return {
    async init() {
      await this.ensureAdminUser();
    },
    async findUserByUsername(username) {
      const rows = await request("app_users", {
        query: {
          select: "*",
          username: `eq.${username}`,
          limit: "1"
        }
      });
      return rowToUser(rows[0]);
    },
    async findUserById(id) {
      const rows = await request("app_users", {
        query: {
          select: "*",
          id: `eq.${id}`,
          limit: "1"
        }
      });
      return rowToUser(rows[0]);
    },
    async listUsers() {
      const rows = await request("app_users", {
        query: {
          select: "*",
          order: "created_at.desc"
        }
      });
      return rows.map(rowToUser);
    },
    async createUser(user) {
      const rows = await request("app_users", {
        method: "POST",
        body: userToRow(user)
      });
      return rowToUser(rows[0]);
    },
    async updateUser(user) {
      const rows = await request("app_users", {
        method: "PATCH",
        query: {
          id: `eq.${user.id}`
        },
        body: userToRow(user)
      });
      return rowToUser(rows[0]);
    },
    async findSessionByToken(token) {
      const rows = await request("app_sessions", {
        query: {
          select: "*",
          token: `eq.${token}`,
          limit: "1"
        }
      });
      return rowToSession(rows[0]);
    },
    async replaceSession(session) {
      await request("app_sessions", {
        method: "DELETE",
        query: {
          user_id: `eq.${session.userId}`
        },
        prefer: "return=minimal"
      });
      const rows = await request("app_sessions", {
        method: "POST",
        body: sessionToRow(session)
      });
      return rowToSession(rows[0]);
    },
    async deleteSessionByToken(token) {
      await request("app_sessions", {
        method: "DELETE",
        query: {
          token: `eq.${token}`
        },
        prefer: "return=minimal"
      });
    },
    async ensureAdminUser() {
      const rows = await request("app_users", {
        query: {
          select: "*",
          role: "eq.admin",
          limit: "1"
        }
      });
      if (rows.length > 0) {
        return;
      }
      await this.createUser(createUserRecord({
        username: "admin",
        displayName: "站长",
        password: "admin123456",
        role: "admin",
        status: "approved",
        note: "默认管理员账号，请尽快修改密码。"
      }));
    },
    async getAppState(userId) {
      const rows = await request("app_states", {
        query: {
          select: "*",
          user_id: `eq.${userId}`,
          limit: "1"
        }
      });
      return rowToAppState(rows[0]);
    },
    async setAppState(userId, state) {
      const existing = await request("app_states", {
        query: {
          select: "user_id",
          user_id: `eq.${userId}`,
          limit: "1"
        }
      });
      if (existing.length > 0) {
        const rows = await request("app_states", {
          method: "PATCH",
          query: {
            user_id: `eq.${userId}`
          },
          body: appStateToRow(userId, state)
        });
        return rowToAppState(rows[0]);
      }
      const rows = await request("app_states", {
        method: "POST",
        body: appStateToRow(userId, state)
      });
      return rowToAppState(rows[0]);
    }
  };
}

const storeAdapter = useSupabase ? createSupabaseStoreAdapter() : createLocalStoreAdapter();

async function getSessionContext(req) {
  const cookies = parseCookies(req);
  const token = cookies.wish_session;
  if (!token) {
    return { session: null, user: null };
  }
  const session = await storeAdapter.findSessionByToken(token);
  if (!session) {
    return { session: null, user: null };
  }
  const user = await storeAdapter.findUserById(session.userId);
  return {
    session,
    user: user || null
  };
}

async function createSessionForUser(res, user) {
  const token = crypto.randomBytes(24).toString("hex");
  const session = {
    token,
    userId: user.id,
    createdAt: new Date().toISOString()
  };
  user.lastLoginAt = new Date().toISOString();
  await storeAdapter.updateUser(user);
  await storeAdapter.replaceSession(session);
  setCookie(res, "wish_session", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
  setCookie(res, "wish_user", user.id, { maxAge: 60 * 60 * 24 * 30 });
}

async function destroySession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies.wish_session;
  if (token) {
    await storeAdapter.deleteSessionByToken(token);
  }
  clearCookie(res, "wish_session");
  clearCookie(res, "wish_user");
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/session" && req.method === "GET") {
    const { user } = await getSessionContext(req);
    sendJson(res, 200, {
      authenticated: Boolean(user),
      user: sanitizeUser(user)
    });
    return true;
  }

  if (pathname === "/api/register" && req.method === "POST") {
    let body;
    try {
      body = await requireJsonBody(req);
    } catch {
      sendJson(res, 400, { ok: false, message: "提交内容格式不正确。" });
      return true;
    }

    const username = String(body.username || "").trim().toLowerCase();
    const displayName = String(body.displayName || "").trim();
    const password = String(body.password || "");
    const note = String(body.note || "").trim();

    if (!username || !displayName || password.length < 6) {
      sendJson(res, 400, { ok: false, message: "请完整填写昵称、用户名和至少 6 位密码。" });
      return true;
    }

    const existingUser = await storeAdapter.findUserByUsername(username);
    if (existingUser) {
      sendJson(res, 409, { ok: false, message: "这个用户名已经被申请了，换一个吧。" });
      return true;
    }

    await storeAdapter.createUser(createUserRecord({ username, displayName, password, note }));
    sendJson(res, 200, {
      ok: true,
      message: "注册申请已提交，等待管理员审核通过后才能登录。"
    });
    return true;
  }

  if (pathname === "/api/login" && req.method === "POST") {
    let body;
    try {
      body = await requireJsonBody(req);
    } catch {
      sendJson(res, 400, { ok: false, message: "登录信息格式不正确。" });
      return true;
    }

    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = await storeAdapter.findUserByUsername(username);

    if (!user || !verifyPassword(password, user)) {
      sendJson(res, 401, { ok: false, message: "用户名或密码不正确。" });
      return true;
    }

    if (!isApprovedUser(user)) {
      sendJson(res, 403, {
        ok: false,
        status: user.status,
        message: user.status === "rejected"
          ? "你的申请暂未通过，请联系管理员。"
          : "你的账号还在等待管理员审核。"
      });
      return true;
    }

    await createSessionForUser(res, user);
    sendJson(res, 200, {
      ok: true,
      user: sanitizeUser(user)
    });
    return true;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    await destroySession(req, res);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/app-state" && req.method === "GET") {
    const { user } = await getSessionContext(req);
    if (!isApprovedUser(user)) {
      sendJson(res, 401, { ok: false, message: "请先登录。" });
      return true;
    }
    const state = await storeAdapter.getAppState(user.id);
    sendJson(res, 200, { ok: true, state });
    return true;
  }

  if (pathname === "/api/app-state" && req.method === "POST") {
    const { user } = await getSessionContext(req);
    if (!isApprovedUser(user)) {
      sendJson(res, 401, { ok: false, message: "请先登录。" });
      return true;
    }
    let body;
    try {
      body = await requireJsonBody(req);
    } catch {
      sendJson(res, 400, { ok: false, message: "提交内容格式不正确。" });
      return true;
    }
    await storeAdapter.setAppState(user.id, body?.state || null);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/admin/users" && req.method === "GET") {
    const { user } = await getSessionContext(req);
    if (!isAdmin(user)) {
      sendJson(res, 403, { ok: false, message: "只有管理员可以查看。" });
      return true;
    }

    const users = (await storeAdapter.listUsers())
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(sanitizeUser);

    sendJson(res, 200, { ok: true, users });
    return true;
  }

  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/(approve|reject)$/);
  if (adminUserMatch && req.method === "POST") {
    const targetUserId = adminUserMatch[1];
    const action = adminUserMatch[2];
    const { user } = await getSessionContext(req);
    if (!isAdmin(user)) {
      sendJson(res, 403, { ok: false, message: "只有管理员可以操作。" });
      return true;
    }

    const target = await storeAdapter.findUserById(targetUserId);
    if (!target) {
      sendJson(res, 404, { ok: false, message: "没有找到这个用户。" });
      return true;
    }

    if (action === "approve") {
      target.status = "approved";
      target.approvedAt = new Date().toISOString();
      target.approvedBy = user.username;
      target.rejectedAt = null;
      target.rejectedBy = null;
    } else {
      target.status = "rejected";
      target.rejectedAt = new Date().toISOString();
      target.rejectedBy = user.username;
    }

    await storeAdapter.updateUser(target);
    sendJson(res, 200, { ok: true, user: sanitizeUser(target) });
    return true;
  }

  if (pathname === "/api/admin/change-password" && req.method === "POST") {
    let body;
    try {
      body = await requireJsonBody(req);
    } catch {
      sendJson(res, 400, { ok: false, message: "提交内容格式不正确。" });
      return true;
    }

    const { user } = await getSessionContext(req);
    if (!isAdmin(user)) {
      sendJson(res, 403, { ok: false, message: "只有管理员可以修改密码。" });
      return true;
    }

    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!verifyPassword(currentPassword, user)) {
      sendJson(res, 400, { ok: false, message: "当前密码不正确。" });
      return true;
    }

    if (newPassword.length < 8) {
      sendJson(res, 400, { ok: false, message: "新密码至少要 8 位。" });
      return true;
    }

    const nextSalt = crypto.randomBytes(16).toString("hex");
    user.salt = nextSalt;
    user.passwordHash = hashPassword(newPassword, nextSalt);
    await storeAdapter.updateUser(user);
    sendJson(res, 200, { ok: true, message: "管理员密码已更新。" });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${port}`}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    const apiHandled = await handleApi(req, res, pathname);
    if (apiHandled) {
      return;
    }

    if (pathname === "/") {
      const { user } = await getSessionContext(req);
      sendRedirect(res, isApprovedUser(user) ? "/index.html" : "/auth.html");
      return;
    }

    const { user } = await getSessionContext(req);

    if (shouldProtectAdmin(pathname) && !isAdmin(user)) {
      sendRedirect(res, isApprovedUser(user) ? "/index.html" : `/auth.html?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (shouldProtectPage(pathname) && !isApprovedUser(user)) {
      sendRedirect(res, `/auth.html?redirect=${encodeURIComponent(pathname + (url.search || ""))}`);
      return;
    }

    const relativePath = getSafeRelativePath(pathname);
    if (isForbiddenStaticPath(relativePath)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    const filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    serveFile(res, filePath);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: false,
      message: "服务器处理失败。",
      detail: error.message
    }));
  }
});

async function start() {
  await storeAdapter.init();
  server.listen(port, host, () => {
    const lanAddress = getLanAddress();
    console.log(`Preview server running at http://127.0.0.1:${port}`);
    if (lanAddress) {
      console.log(`LAN preview available at http://${lanAddress}:${port}`);
    }
    console.log(`Storage mode: ${useSupabase ? "supabase" : "local-json"}`);
    console.log("Default admin account: admin / admin123456");
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
