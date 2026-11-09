var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var COOKIE = "as_admin";
var enc = new TextEncoder();
var json = /* @__PURE__ */ __name((d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } }), "json");
var clean = /* @__PURE__ */ __name((v, n = 1e5) => typeof v === "string" ? v.trim().slice(0, n) : "", "clean");
var b64 = /* @__PURE__ */ __name((b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64");
async function mac(secret, v) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", k, enc.encode(v)));
}
__name(mac, "mac");
async function makeSession(env, u) {
  const p = b64(enc.encode(JSON.stringify({ u, exp: Date.now() + 288e5 })));
  return p + "." + await mac(env.SESSION_SECRET, p);
}
__name(makeSession, "makeSession");
async function authorized(req, env) {
  const c = (req.headers.get("Cookie") || "").split(";").map((x) => x.trim()).find((x) => x.startsWith(COOKIE + "="));
  if (!c || !env.SESSION_SECRET) return false;
  const [p, s] = c.slice(COOKIE.length + 1).split(".");
  if (!p || !s || s !== await mac(env.SESSION_SECRET, p)) return false;
  try {
    const v = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return !!v.u && v.exp > Date.now();
  } catch {
    return false;
  }
}
__name(authorized, "authorized");
var config = { albums: { fields: ["title", "description", "event_date", "source_url", "cover_url", "status"], required: ["title"], limits: { title: 180, description: 5e3, event_date: 60, source_url: 2e3, cover_url: 2e3, status: 20 } }, articles: { fields: ["title", "category", "excerpt", "body", "cover_url", "author", "status", "is_magazine"], required: ["title", "body"], limits: { title: 220, category: 100, excerpt: 1e3, body: 1e5, cover_url: 2e3, author: 120, status: 20, is_magazine: 1 } } };
var GOOGLE_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/drive.readonly";
var GOOGLE_TOKEN_ID = "admin";
var b64url = /* @__PURE__ */ __name((b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64url");
var unb64 = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)), "unb64");
function redirect(url, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: url, ...headers } });
}
__name(redirect, "redirect");
async function googleAccess(env) {
  const row = await env.DB.prepare("SELECT encrypted_refresh_token FROM google_oauth_tokens WHERE id=?").bind(GOOGLE_TOKEN_ID).first();
  if (!row) return null;
  const refresh = await decryptToken(env, row.encrypted_refresh_token);
  const form = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: "refresh_token" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
  const d = await r.json();
  if (!r.ok) throw new Error("Google OAuth: " + (d.error_description || d.error || "refresh failed"));
  return d.access_token;
}
__name(googleAccess, "googleAccess");
async function encryptToken(env, value) {
  const key = await crypto.subtle.digest("SHA-256", enc.encode(env.GOOGLE_TOKEN_ENCRYPTION_KEY));
  const aes = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, enc.encode(value));
  return b64url(iv) + "." + b64url(ct);
}
__name(encryptToken, "encryptToken");
async function decryptToken(env, value) {
  const [iv, ct] = value.split(".");
  const key = await crypto.subtle.digest("SHA-256", enc.encode(env.GOOGLE_TOKEN_ENCRYPTION_KEY));
  const aes = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, aes, unb64(ct)));
}
__name(decryptToken, "decryptToken");
async function googleApi(path, token, init = {}) {
  const r = await fetch("https://photospicker.googleapis.com/v1/" + path, { ...init, headers: { Authorization: "Bearer " + token, ...init.headers || {} } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || "Erreur Google Photos");
  return d;
}
__name(googleApi, "googleApi");
async function googleRoutes(req, env, u) {
  const p = u.pathname, m = req.method;
  if (p === "/api/google/status" && m === "GET") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const r = await env.DB.prepare("SELECT id FROM google_oauth_tokens WHERE id=?").bind(GOOGLE_TOKEN_ID).first();
    return json({ connected: !!r });
  }
  if (p === "/api/google/connect" && m === "GET") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_TOKEN_ENCRYPTION_KEY) return json({ error: "Configuration Google OAuth manquante." }, 503);
    const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
    const cb = u.origin + "/api/google/callback";
    const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: cb, response_type: "code", scope: GOOGLE_SCOPE, access_type: "offline", prompt: "consent", state });
    return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + q.toString(), { "Set-Cookie": "gp_state=" + state + "; HttpOnly; Secure; SameSite=Lax; Path=/api/google; Max-Age=600" });
  }
  if (p === "/api/google/callback" && m === "GET") {
    if (!await authorized(req, env)) return new Response("Session administrateur requise.", { status: 401 });
    const state = u.searchParams.get("state"), cookie = (req.headers.get("Cookie") || "").split(";").map((x) => x.trim()).find((x) => x.startsWith("gp_state="))?.slice(9);
    if (!state || state !== cookie) return new Response("\xC9tat OAuth invalide.", { status: 400 });
    if (u.searchParams.get("error")) return redirect("/admin?google=cancelled");
    const form = new URLSearchParams({ code: u.searchParams.get("code") || "", client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: u.origin + "/api/google/callback", grant_type: "authorization_code" });
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
    const d = await r.json();
    if (!r.ok || !d.refresh_token) return new Response("Google n\u2019a pas fourni de jeton de renouvellement. Recommencez la connexion en autorisant l\u2019acc\xE8s.", { status: 400 });
    const encrypted = await encryptToken(env, d.refresh_token);
    await env.DB.prepare("INSERT INTO google_oauth_tokens(id,encrypted_refresh_token) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET encrypted_refresh_token=excluded.encrypted_refresh_token,updated_at=CURRENT_TIMESTAMP").bind(GOOGLE_TOKEN_ID, encrypted).run();
    return redirect("/admin?google=connected", { "Set-Cookie": "gp_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/google; Max-Age=0" });
  }
  if (p === "/api/google/picker" && m === "POST") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const b = await req.json().catch(() => ({}));
    const album = await env.DB.prepare("SELECT id FROM albums WHERE id=?").bind(clean(b.album_id, 100)).first();
    if (!album) return json({ error: "Album introuvable." }, 404);
    const token = await googleAccess(env);
    if (!token) return json({ error: "Connecte d\u2019abord Google Photos." }, 409);
    const d = await googleApi("sessions", token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    await env.DB.prepare("INSERT INTO google_picker_sessions(id,album_id) VALUES(?,?)").bind(d.id, album.id).run();
    return json({ sessionId: d.id, pickerUri: d.pickerUri, pollInterval: d.pollingConfig?.pollInterval || "3s", timeoutIn: d.pollingConfig?.timeoutIn || "300s" });
  }
  if (p === "/api/google/drive-import" && m === "POST") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const b = await req.json().catch(() => ({})), albumId = clean(b.album_id, 100), folder = clean(b.folder_id, 200);
    if (!albumId || !folder) return json({ error: "Album et identifiant du dossier Drive obligatoires." }, 400);
    const album = await env.DB.prepare("SELECT id FROM albums WHERE id=?").bind(albumId).first();
    if (!album) return json({ error: "Album introuvable." }, 404);
    const token = await googleAccess(env);
    if (!token) return json({ error: "Connecte ou reconnecte Google pour autoriser Drive." }, 409);
    let pageToken = "", imported = 0, skipped = 0, cover = "";
    do {
      const q = new URLSearchParams({ q: "'" + folder + "' in parents and trashed=false", pageSize: "100", fields: "nextPageToken,files(id,name,mimeType)", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
      if (pageToken) q.set("pageToken", pageToken);
      const lr = await fetch("https://www.googleapis.com/drive/v3/files?" + q.toString(), { headers: { Authorization: "Bearer " + token } });
      const ld = await lr.json().catch(() => ({}));
      if (!lr.ok) throw new Error(ld.error?.message || "Impossible de lire le dossier Google Drive");
      for (const file of ld.files || []) {
        const existing = await env.DB.prepare("SELECT id FROM album_photos WHERE google_media_id=?").bind("drive:" + file.id).first();
        if (existing) {
          skipped++;
          continue;
        }
        const mime = file.mimeType || "";
        if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
          skipped++;
          continue;
        }
        const fr = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.id) + "?alt=media", { headers: { Authorization: "Bearer " + token } });
        if (!fr.ok) {
          skipped++;
          continue;
        }
        const ext = (file.name.split(".").pop() || (mime === "image/jpeg" ? "jpg" : "bin")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
        const key = "albums/" + albumId + "/" + crypto.randomUUID() + "." + ext;
        await env.GALLERY.put(key, fr.body, { httpMetadata: { contentType: mime } });
        const url = (env.R2_PUBLIC_BASE || "").replace(/\/$/, "") + "/" + key;
        await env.DB.prepare("INSERT INTO album_photos(id,album_id,object_key,public_url,mime_type,google_media_id) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), albumId, key, url, mime, "drive:" + file.id).run();
        if (!cover && mime.startsWith("image/")) cover = url;
        imported++;
      }
      pageToken = ld.nextPageToken || "";
    } while (pageToken);
    if (cover) await env.DB.prepare("UPDATE albums SET cover_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (cover_url IS NULL OR cover_url='')").bind(cover, albumId).run();
    return json({ ok: true, imported, skipped, message: imported + " fichier(s) import\xE9(s) depuis Google Drive." });
  }
  if (p === "/api/google/import" && m === "POST") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const b = await req.json().catch(() => ({}));
    const sess = await env.DB.prepare("SELECT * FROM google_picker_sessions WHERE id=?").bind(clean(b.session_id, 200)).first();
    if (!sess) return json({ error: "Session de s\xE9lection introuvable." }, 404);
    const token = await googleAccess(env);
    const status = await googleApi("sessions/" + encodeURIComponent(sess.id), token);
    if (!status.mediaItemsSet) return json({ ready: false, message: "S\xE9lection Google Photos pas encore termin\xE9e." }, 202);
    let pageToken = "", imported = 0, cover = "";
    do {
      const q = new URLSearchParams({ sessionId: sess.id, pageSize: "100" });
      if (pageToken) q.set("pageToken", pageToken);
      const list = await googleApi("mediaItems?" + q.toString(), token);
      for (const item of list.mediaItems || []) {
        const mediaId = clean(item.id, 300);
        if (!mediaId) continue;
        const existing = await env.DB.prepare("SELECT id FROM album_photos WHERE google_media_id=?").bind(mediaId).first();
        if (existing) continue;
        const mf = item.mediaFile || {}, mime = mf.mimeType || "image/jpeg";
        if (!mime.startsWith("image/") && !mime.startsWith("video/")) continue;
        const suffix = mime.startsWith("video/") ? "=dv" : "=d";
        const response = await fetch(mf.baseUrl + suffix, { headers: { Authorization: "Bearer " + token } });
        if (!response.ok) continue;
        const ext = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "");
        const key = "albums/" + sess.album_id + "/" + crypto.randomUUID() + "." + ext;
        await env.GALLERY.put(key, response.body, { httpMetadata: { contentType: mime } });
        const base = env.R2_PUBLIC_BASE || "";
        const url = base.replace(/\/$/, "") + "/" + key;
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO album_photos(id,album_id,object_key,public_url,mime_type,google_media_id) VALUES(?,?,?,?,?,?)").bind(id, sess.album_id, key, url, mime, mediaId).run();
        if (!cover && mime.startsWith("image/")) cover = url;
        imported++;
      }
      pageToken = list.nextPageToken || "";
    } while (pageToken);
    if (cover) await env.DB.prepare("UPDATE albums SET cover_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (cover_url IS NULL OR cover_url='')").bind(cover, sess.album_id).run();
    await env.DB.prepare("DELETE FROM google_picker_sessions WHERE id=?").bind(sess.id).run();
    await googleApi("sessions/" + encodeURIComponent(sess.id), token, { method: "DELETE" }).catch(() => {
    });
    return json({ ready: true, imported, coverUrl: cover });
  }
  return null;
}
__name(googleRoutes, "googleRoutes");
var BLOG_COOKIE = "as_blogger";
async function makeBloggerSession(env, id) {
  const p = b64(enc.encode(JSON.stringify({ id, exp: Date.now() + 288e5 })));
  return p + "." + await mac(env.SESSION_SECRET, p);
}
__name(makeBloggerSession, "makeBloggerSession");
async function bloggerAuthorized(req, env) {
  const c = (req.headers.get("Cookie") || "").split(";").map((x) => x.trim()).find((x) => x.startsWith(BLOG_COOKIE + "="));
  if (!c || !env.SESSION_SECRET) return null;
  const [p, s] = c.slice(BLOG_COOKIE.length + 1).split(".");
  if (!p || !s || s !== await mac(env.SESSION_SECRET, p)) return null;
  try {
    const v = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    if (v.exp < Date.now()) return null;
    return await env.DB.prepare("SELECT id,name,email,phone,status FROM bloggers WHERE id=? AND status='active'").bind(v.id).first();
  } catch {
    return null;
  }
}
__name(bloggerAuthorized, "bloggerAuthorized");
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
__name(escapeHtml, "escapeHtml");
async function sendActuScoutMail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !env.ACTUSCOUT_EMAIL_FROM) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" }, body: JSON.stringify({ from: env.ACTUSCOUT_EMAIL_FROM, to, subject, html }) });
  return response.ok;
}
__name(sendActuScoutMail, "sendActuScoutMail");
async function api(req, env) {
  const u = new URL(req.url), p = u.pathname, m = req.method;
  const gr = await googleRoutes(req, env, u);
  if (gr) return gr;
  if (p === "/api/upload" && m === "POST") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    if (!env.GALLERY || !env.R2_PUBLIC_BASE) return json({ error: "Stockage R2 non configur\xE9." }, 503);
    const form = await req.formData();
    const file = form.get("file"), albumId = clean(form.get("album_id"), 100);
    if (!file || typeof file.arrayBuffer !== "function" || !file.size) return json({ error: "Choisis un fichier \xE0 envoyer." }, 400);
    if (file.size > 10 * 1024 * 1024) return json({ error: "Fichier trop volumineux : limite de 10 Mo." }, 413);
    const mime = file.type || "application/octet-stream";
    if (!mime.startsWith("image/") && !mime.startsWith("video/")) return json({ error: "Seules les images et vid\xE9os sont accept\xE9es." }, 415);
    const album = await env.DB.prepare("SELECT id FROM albums WHERE id=?").bind(albumId).first();
    if (!album) return json({ error: "Album introuvable." }, 404);
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const key = "albums/" + albumId + "/" + crypto.randomUUID() + "." + ext;
    await env.GALLERY.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: mime } });
    const url = env.R2_PUBLIC_BASE.replace(/\/$/, "") + "/" + key;
    const id2 = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO album_photos(id,album_id,object_key,public_url,mime_type) VALUES(?,?,?,?,?)").bind(id2, albumId, key, url, mime).run();
    if (mime.startsWith("image/")) await env.DB.prepare("UPDATE albums SET cover_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (cover_url IS NULL OR cover_url='')").bind(url, albumId).run();
    return json({ ok: true, id: id2, url, key }, 201);
  }
  if (p === "/api/blogger/apply" && m === "POST") {
    const f = await req.formData(), name = clean(f.get("name"), 160), email = clean(f.get("email"), 200).toLowerCase(), phone = clean(f.get("phone"), 60), city = clean(f.get("city"), 120), motivation = clean(f.get("motivation"), 5e3), file = f.get("cv");
    if (!name || !email || !phone || !motivation || !file || !file.size) return json({ error: "Tous les champs et le CV PDF sont obligatoires." }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Adresse e-mail invalide." }, 400);
    if (file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) return json({ error: "Le CV doit \xEAtre un PDF de 5 Mo maximum." }, 400);
    if (await file.slice(0, 5).text() !== "%PDF-") return json({ error: "Le fichier transmis ne poss\xE8de pas une signature PDF valide." }, 415);
    const account = await env.DB.prepare("SELECT id,status FROM bloggers WHERE email=? COLLATE NOCASE").bind(email).first();
    if (account) return json({ error: account.status === "active" ? "Un compte blogueur existe d\xE9j\xE0 avec cette adresse. Connecte-toi \xE0 ton espace blogueur." : "Cette adresse est d\xE9j\xE0 associ\xE9e \xE0 un compte blogueur suspendu. Contacte la r\xE9daction ActuScout." }, 409);
    const duplicate = await env.DB.prepare("SELECT id FROM blogger_applications WHERE email=? COLLATE NOCASE AND status='pending'").bind(email).first();
    if (duplicate) return json({ error: "Une candidature en attente existe d\xE9j\xE0 pour cette adresse." }, 409);
    if (!env.GALLERY) return json({ error: "Le stockage des candidatures est temporairement indisponible." }, 503);
    const id2 = crypto.randomUUID(), key = "candidatures/" + id2 + ".pdf";
    await env.GALLERY.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: "application/pdf" } });
    let saved;
    try {
      saved = await env.DB.prepare("INSERT INTO blogger_applications(id,name,email,phone,city,motivation,cv_key,status) SELECT ?,?,?,?,?,?,?,'pending' WHERE NOT EXISTS(SELECT 1 FROM blogger_applications WHERE email=? COLLATE NOCASE AND status='pending') AND NOT EXISTS(SELECT 1 FROM bloggers WHERE email=? COLLATE NOCASE)").bind(id2, name, email, phone, city, motivation, key, email, email).run();
    } catch (error) {
      await env.GALLERY.delete(key).catch(() => {
      });
      throw error;
    }
    if (!saved.meta?.changes) {
      await env.GALLERY.delete(key);
      const account2 = await env.DB.prepare("SELECT status FROM bloggers WHERE email=? COLLATE NOCASE").bind(email).first();
      return json({ error: account2 ? account2.status === "active" ? "Un compte blogueur existe d\xE9j\xE0 avec cette adresse. Connecte-toi \xE0 ton espace blogueur." : "Cette adresse est d\xE9j\xE0 associ\xE9e \xE0 un compte blogueur suspendu. Contacte la r\xE9daction ActuScout." : "Une candidature en attente existe d\xE9j\xE0 pour cette adresse." }, 409);
    }
    return json({ ok: true, message: "Candidature re\xE7ue. Elle sera examin\xE9e par la r\xE9daction ActuScout." }, 201);
  }
  if (p === "/api/blogger/login" && m === "POST") {
    const b = await req.json().catch(() => ({})), email = clean(b.email, 200).toLowerCase(), password = typeof b.password === "string" ? b.password.slice(0, 300) : "";
    const row = await env.DB.prepare("SELECT id,name,email,phone,status,password_hash FROM bloggers WHERE email=? AND status='active'").bind(email).first();
    if (!row || !env.SESSION_SECRET || await mac(env.SESSION_SECRET, password) !== row.password_hash) return json({ error: "Identifiants incorrects ou compte non activ\xE9." }, 401);
    const { password_hash, ...profile } = row;
    return json({ ok: true, blogger: profile }, 200, { "set-cookie": BLOG_COOKIE + "=" + await makeBloggerSession(env, row.id) + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800" });
  }
  if (p === "/api/blogger/logout" && m === "POST") return json({ ok: true }, 200, { "set-cookie": BLOG_COOKIE + "=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" });
  if (p === "/api/blogger/password" && m === "POST") {
    const blogger = await bloggerAuthorized(req, env);
    if (!blogger) return json({ error: "Connexion blogueur requise." }, 401);
    const b = await req.json().catch(() => ({})), current = typeof b.current_password === "string" ? b.current_password.slice(0, 300) : "", next = typeof b.new_password === "string" ? b.new_password.slice(0, 300) : "";
    if (next.length < 10) return json({ error: "Le nouveau mot de passe doit contenir au moins 10 caract\xE8res." }, 400);
    const row = await env.DB.prepare("SELECT password_hash FROM bloggers WHERE id=? AND status='active'").bind(blogger.id).first();
    if (!row || !env.SESSION_SECRET || await mac(env.SESSION_SECRET, current) !== row.password_hash) return json({ error: "Mot de passe actuel incorrect." }, 401);
    await env.DB.prepare("UPDATE bloggers SET password_hash=? WHERE id=?").bind(await mac(env.SESSION_SECRET, next), blogger.id).run();
    return json({ ok: true, message: "Mot de passe modifi\xE9." });
  }
  if (p.startsWith("/api/blogger/")) {
    const blogger = await bloggerAuthorized(req, env);
    if (!blogger) return json({ error: "Connexion blogueur requise." }, 401);
    if (p === "/api/blogger/me" && m === "GET") return json(blogger);
    if (p === "/api/blogger/articles" && m === "GET") {
      const rows = await env.DB.prepare("SELECT id,title,category,excerpt,status,created_at,updated_at FROM articles WHERE blogger_id=? ORDER BY created_at DESC").bind(blogger.id).all();
      return json(rows.results || []);
    }
    if (p === "/api/blogger/articles" && m === "POST") {
      const b = await req.json().catch(() => ({}));
      if (!clean(b.title, 220) || !clean(b.body, 1e5)) return json({ error: "Titre et contenu obligatoires." }, 400);
      const id2 = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO articles(id,title,category,excerpt,body,cover_url,author,status,blogger_id) VALUES(?,?,?,?,?,?,?,'pending',?)").bind(id2, clean(b.title, 220), clean(b.category, 100), clean(b.excerpt, 1e3), clean(b.body, 1e5), clean(b.cover_url, 2e3), blogger.name, blogger.id).run();
      return json({ ok: true, id: id2, message: "Article transmis \xE0 la r\xE9daction pour validation." }, 201);
    }
    return json({ error: "Route blogueur introuvable." }, 404);
  }
  if (p === "/api/admin/blogger-applications" && m === "GET") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const r = await env.DB.prepare("SELECT id,name,email,phone,city,motivation,status,cv_key,created_at FROM blogger_applications ORDER BY created_at DESC").all();
    return json((r.results || []).map((a) => ({ ...a, cv_url: "/api/admin/blogger-applications/" + a.id + "/cv" })));
  }
  if (p === "/api/admin/bloggers" && m === "GET") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const r = await env.DB.prepare("SELECT id,name,email,phone,status,created_at FROM bloggers ORDER BY created_at DESC").all();
    return json(r.results || []);
  }
  const cvMatch = p.match(/^\/api\/admin\/blogger-applications\/([^/]+)\/cv$/);
  if (cvMatch && m === "GET") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const a = await env.DB.prepare("SELECT cv_key FROM blogger_applications WHERE id=?").bind(cvMatch[1]).first();
    if (!a) return json({ error: "CV introuvable." }, 404);
    const obj = await env.GALLERY.get(a.cv_key);
    return obj ? new Response(obj.body, { headers: { "content-type": "application/pdf", "content-disposition": 'inline; filename="CV-candidat.pdf"', "cache-control": "no-store" } }) : json({ error: "Fichier CV absent." }, 404);
  }
  const reviewMatch = p.match(/^\/api\/admin\/articles\/([^/]+)\/publish$/);
  if (reviewMatch && m === "POST") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const result = await env.DB.prepare("UPDATE articles SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(reviewMatch[1]).run();
    if (!result.meta?.changes) return json({ error: "Cet article a d\xE9j\xE0 \xE9t\xE9 trait\xE9 ou n\u2019existe plus dans les articles en attente." }, 409);
    return json({ ok: true, message: "Article valid\xE9 et publi\xE9." });
  }
  const rejectMatch = p.match(/^\/api\/admin\/articles\/([^/]+)\/reject$/);
  if (rejectMatch && m === "POST") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const result = await env.DB.prepare("UPDATE articles SET status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(rejectMatch[1]).run();
    if (!result.meta?.changes) return json({ error: "Cet article a d\xE9j\xE0 \xE9t\xE9 trait\xE9 ou n\u2019existe plus dans les articles en attente." }, 409);
    return json({ ok: true, message: "Article renvoy\xE9 en brouillon." });
  }
  const bloggerStatus = p.match(/^\/api\/admin\/bloggers\/([^/]+)\/status$/);
  if (bloggerStatus && m === "POST") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const b = await req.json().catch(() => ({}));
    if (!["active", "suspended"].includes(b.status)) return json({ error: "Statut invalide." }, 400);
    const x = await env.DB.prepare("UPDATE bloggers SET status=? WHERE id=?").bind(b.status, bloggerStatus[1]).run();
    if (!x.meta?.changes) return json({ error: "Compte blogueur introuvable." }, 404);
    return json({ ok: true });
  }
  const appDecision = p.match(/^\/api\/admin\/blogger-applications\/([^/]+)\/decision$/);
  if (appDecision && m === "POST") {
    if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
    const b = await req.json().catch(() => ({})), status = b.status;
    if (!["accepted", "rejected"].includes(status)) return json({ error: "D\xE9cision invalide." }, 400);
    const a = await env.DB.prepare("SELECT * FROM blogger_applications WHERE id=?").bind(appDecision[1]).first();
    if (!a) return json({ error: "Candidature introuvable." }, 404);
    if (a.status !== "pending") return json({ error: "Cette candidature a d\xE9j\xE0 \xE9t\xE9 trait\xE9e." }, 409);
    if (status === "accepted" && !env.SESSION_SECRET) return json({ error: "Configuration de s\xE9curit\xE9 manquante : impossible de cr\xE9er le compte." }, 503);
    if (status === "accepted") {
      const temp = crypto.randomUUID().replace(/-/g, "") + "Aa1!";
      const hash = await mac(env.SESSION_SECRET, temp);
      const results = await env.DB.batch([env.DB.prepare("INSERT INTO bloggers(id,name,email,phone,password_hash,status,application_id) SELECT ?,?,?,?,?,'active',? WHERE EXISTS(SELECT 1 FROM blogger_applications WHERE id=? AND status='pending') AND NOT EXISTS(SELECT 1 FROM bloggers WHERE email=? COLLATE NOCASE)").bind(crypto.randomUUID(), a.name, a.email, a.phone, hash, a.id, a.id, a.email), env.DB.prepare("UPDATE blogger_applications SET status='accepted',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM bloggers WHERE application_id=? AND email=?)").bind(a.id, a.id, a.email)]);
      if (!results[0]?.meta?.changes) {
        const existing = await env.DB.prepare("SELECT id FROM bloggers WHERE email=?").bind(a.email).first();
        if (existing) return json({ error: "Cette adresse e-mail est d\xE9j\xE0 associ\xE9e \xE0 un compte blogueur. Aucun mot de passe n\u2019a \xE9t\xE9 modifi\xE9." }, 409);
        return json({ error: "Cette candidature vient d\u2019\xEAtre trait\xE9e par une autre session. Actualise la liste." }, 409);
      }
      if (!results[1]?.meta?.changes) return json({ error: "La cr\xE9ation du compte n\u2019a pas pu \xEAtre confirm\xE9e. R\xE9essaie apr\xE8s actualisation." }, 409);
      let emailSent = false;
      try {
        emailSent = await sendActuScoutMail(env, a.email, "Votre candidature ActuScout est accept\xE9e", "<p>Bonjour " + escapeHtml(a.name) + ',</p><p>Votre candidature a \xE9t\xE9 accept\xE9e.</p><p>Acc\xE8s \xE0 l\u2019espace blogueur : <a href="https://actuscout.rigobertmumbere2018.workers.dev/blogueur">ouvrir votre espace</a>.</p><p>Mot de passe temporaire : <b>' + escapeHtml(temp) + "</b></p><p>Connectez-vous puis modifiez imm\xE9diatement ce mot de passe depuis la rubrique S\xE9curit\xE9 du compte.</p>");
      } catch {
      }
      if (emailSent) return json({ ok: true, emailSent: true, message: "Compte cr\xE9\xE9. Les identifiants ont \xE9t\xE9 envoy\xE9s \xE0 l\u2019adresse e-mail du candidat. Il devra modifier son mot de passe d\xE8s sa premi\xE8re connexion." });
      return json({ ok: true, emailSent: false, temporaryPassword: temp, message: "Compte cr\xE9\xE9, mais l\u2019e-mail n\u2019a pas pu \xEAtre envoy\xE9. Transmets le mot de passe temporaire au candidat par un canal priv\xE9. Il devra le modifier d\xE8s sa premi\xE8re connexion." });
    }
    const decision = await env.DB.prepare("UPDATE blogger_applications SET status='rejected',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(a.id).run();
    if (!decision.meta?.changes) return json({ error: "Cette candidature vient d\u2019\xEAtre trait\xE9e par une autre session. Actualise la liste." }, 409);
    return json({ ok: true });
  }
  if (p === "/api/admin/import-blogger" && m === "POST") {
    if (!await authorized(req, env)) return json({ error: "Authentification administrateur requise." }, 401);
    const payload = await req.json().catch(() => null);
    if (!Array.isArray(payload) || payload.length > 500) return json({ error: "Fichier JSON invalide ou trop volumineux." }, 400);
    let imported = 0, skipped = 0, drafts = 0, published = 0, imagesCopied = 0, imagesKept = 0, errors = [];
    for (const item of payload) {
      const sourceId = clean(item.blogger_post_id, 300), title = clean(item.title, 220), body = typeof item.body === "string" ? item.body.slice(0, 1e5) : "";
      if (!sourceId || !body) {
        skipped++;
        errors.push({ id: sourceId || null, error: "Identifiant Blogger ou contenu manquant." });
        continue;
      }
      const exists = await env.DB.prepare("SELECT id FROM articles WHERE blogger_post_id=?").bind(sourceId).first();
      if (exists) {
        skipped++;
        continue;
      }
      const status = title ? "published" : "draft";
      let html = body, cover = clean(item.cover_url, 2e3), urls = Array.isArray(item.image_urls) ? item.image_urls : [];
      const unique = [...new Set(urls.filter((x) => typeof x === "string" && /^https:\/\//i.test(x)))];
      for (let i = 0; i < unique.length; i++) {
        const original = unique[i];
        if (env.GALLERY && env.R2_PUBLIC_BASE) {
          try {
            const response = await fetch(original, { redirect: "follow" });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const type = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
            if (!type.startsWith("image/")) throw new Error("Type m\xE9dia non image");
            const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
            const key = "blogger/" + encodeURIComponent(sourceId.slice(-48)) + "/" + i + "-" + crypto.randomUUID() + "." + ext;
            await env.GALLERY.put(key, response.body, { httpMetadata: { contentType: type } });
            const replacement = env.R2_PUBLIC_BASE.replace(/\/$/, "") + "/" + key;
            html = html.split(original).join(replacement);
            if (cover === original) cover = replacement;
            imagesCopied++;
          } catch (e) {
            imagesKept++;
          }
        } else imagesKept++;
      }
      html = html.replace(/<\s*(script|iframe|object|embed|form|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "").replace(/\s+on[a-z]+\s*=\s*(['"][\s\S]*?\1|[^\s>]+)/gi, "").replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "");
      try {
        await env.DB.prepare("INSERT INTO articles(id,title,category,excerpt,body,cover_url,author,status,created_at,updated_at,blogger_post_id,source_permalink,original_published_at,original_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), title, clean(item.category, 100), clean(item.excerpt, 1e3), html, cover, clean(item.author, 120) || "ActuScout", status, clean(item.original_published_at, 40) || (/* @__PURE__ */ new Date()).toISOString(), clean(item.original_updated_at, 40) || (/* @__PURE__ */ new Date()).toISOString(), sourceId, clean(item.source_permalink, 2e3), clean(item.original_published_at, 40), clean(item.original_updated_at, 40)).run();
        imported++;
        if (status === "published") published++;
        else drafts++;
      } catch (e) {
        errors.push({ id: sourceId, error: "Insertion impossible. V\xE9rifier la migration D1 0004." });
      }
    }
    return json({ ok: errors.length === 0, imported, skipped, published, drafts, imagesCopied, imagesKept, errors }, errors.length ? 207 : 200);
  }
  if (p === "/api/health") return json({ ok: true });
  if (p === "/api/login" && m === "POST") {
    const b = await req.json().catch(() => ({}));
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "Secrets administrateur non configur\xE9s." }, 503);
    if (b.username !== env.ADMIN_USERNAME || b.password !== env.ADMIN_PASSWORD) return json({ error: "Identifiants incorrects." }, 401);
    return json({ ok: true }, 200, { "set-cookie": COOKIE + "=" + await makeSession(env, env.ADMIN_USERNAME) + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800" });
  }
  if (p === "/api/logout" && m === "POST") return json({ ok: true }, 200, { "set-cookie": COOKIE + "=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" });
  if (p === "/api/public/magazine" && m === "GET") { const r = await env.DB.prepare("SELECT a.id,a.title,a.category,a.excerpt,a.body,a.cover_url,a.author,a.created_at,(SELECT COUNT(*) FROM article_views v WHERE v.article_id=a.id) AS view_count,(SELECT COUNT(*) FROM article_likes l WHERE l.article_id=a.id) AS like_count FROM articles a WHERE a.status='published' AND a.is_magazine=1 ORDER BY a.created_at DESC LIMIT 12").all(); return json(r.results || []); }
  if (p === "/api/public/albums" && m === "GET") {
    const r = await env.DB.prepare("SELECT id,title,description,event_date,source_url,cover_url,status,created_at,updated_at FROM albums WHERE status='published' ORDER BY created_at DESC").all();
    const rows = r.results || [];
    await Promise.all(rows.map(async (a) => {
      try {
        const ph = await env.DB.prepare("SELECT id,public_url,mime_type,created_at FROM album_photos WHERE album_id=? ORDER BY created_at ASC").bind(a.id).all();
        a.photos = ph.results || [];
      } catch (e) {
        a.photos = [];
        a.photos_error = true;
      }
    }));
    return json(rows);
  }
  if (p === "/api/public/article-engagement" && m === "GET") {
    const id = clean(u.searchParams.get("id"), 200), visitorId = clean(u.searchParams.get("visitor_id"), 80);
    if (!id) return json({ error: "Article manquant." }, 400);
    const article = await env.DB.prepare("SELECT id FROM articles WHERE id=? AND status='published'").bind(id).first();
    if (!article) return json({ error: "Article introuvable." }, 404);
    const stats = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM article_views WHERE article_id=?) AS view_count, (SELECT COUNT(*) FROM article_likes WHERE article_id=?) AS like_count, EXISTS(SELECT 1 FROM article_likes WHERE article_id=? AND visitor_id=?) AS liked").bind(id,id,id,visitorId).first();
    return json(stats || { view_count: 0, like_count: 0, liked: 0 });
  }
  if ((p === "/api/public/article-view" || p === "/api/public/article-like") && m === "POST") {
    const payload = await req.json().catch(() => null);
    const id = clean(payload && payload.article_id, 200), visitorId = clean(payload && payload.visitor_id, 80);
    if (!id || !/^[a-zA-Z0-9-]{16,80}$/.test(visitorId)) return json({ error: "Identifiant invalide." }, 400);
    const article = await env.DB.prepare("SELECT id FROM articles WHERE id=? AND status='published'").bind(id).first();
    if (!article) return json({ error: "Article introuvable." }, 404);
    if (p === "/api/public/article-view") {
      const day = new Date().toISOString().slice(0,10);
      await env.DB.prepare("INSERT OR IGNORE INTO article_views(article_id,visitor_id,view_date) VALUES(?,?,?)").bind(id,visitorId,day).run();
    } else if (payload.liked) {
      await env.DB.prepare("INSERT OR IGNORE INTO article_likes(article_id,visitor_id) VALUES(?,?)").bind(id,visitorId).run();
    } else {
      await env.DB.prepare("DELETE FROM article_likes WHERE article_id=? AND visitor_id=?").bind(id,visitorId).run();
    }
    const stats = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM article_views WHERE article_id=?) AS view_count, (SELECT COUNT(*) FROM article_likes WHERE article_id=?) AS like_count, EXISTS(SELECT 1 FROM article_likes WHERE article_id=? AND visitor_id=?) AS liked").bind(id,id,id,visitorId).first();
    return json(stats || { view_count: 0, like_count: 0, liked: 0 });
  }
  const pub = p.match(/^\/api\/public\/(albums|articles)$/);
  if (pub && m === "GET") {
    const k = pub[1], visitorId = clean(u.searchParams.get("visitor_id"), 80), sql = k === "articles" ? "SELECT a.*, (SELECT COUNT(*) FROM article_views v WHERE v.article_id=a.id) AS view_count, (SELECT COUNT(*) FROM article_likes l WHERE l.article_id=a.id) AS like_count, EXISTS(SELECT 1 FROM article_likes l WHERE l.article_id=a.id AND l.visitor_id=?) AS liked_by_visitor FROM articles a WHERE a.status='published' ORDER BY a.created_at DESC" : "SELECT * FROM albums WHERE status='published' ORDER BY created_at DESC", r = k === "articles" ? await env.DB.prepare(sql).bind(visitorId).all() : await env.DB.prepare(sql).all();
    return json(r.results || []);
  }
  if (!await authorized(req, env)) return json({ error: "Authentification requise." }, 401);
  if (p === "/api/article-cover-upload" && m === "POST") {
    if (!env.GALLERY || !env.R2_PUBLIC_BASE) return json({ error: "Stockage des images non configuré." }, 503);
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function" || !file.size) return json({ error: "Choisis une image à envoyer." }, 400);
    if (file.size > 10 * 1024 * 1024) return json({ error: "Image trop volumineuse : limite de 10 Mo." }, 413);
    const mime = file.type || "";
    const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    if (!types[mime]) return json({ error: "Formats acceptés : JPG, PNG, WebP ou GIF." }, 415);
    const key = "article-covers/" + crypto.randomUUID() + "." + types[mime];
    await env.GALLERY.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" } });
    const url = env.R2_PUBLIC_BASE.replace(/\/$/, "") + "/" + key;
    return json({ ok: true, url }, 201);
  }

  if (p === "/api/me") return json({ authenticated: true });
  const match = p.match(/^\/api\/(albums|articles)(?:\/([^/]+))?$/);
  if (!match) return json({ error: "Route introuvable." }, 404);
  const kind = match[1], id = match[2], cfg = config[kind];
  if (m === "GET" && !id) {
    const r = await env.DB.prepare("SELECT * FROM " + kind + " ORDER BY created_at DESC").all();
    return json(r.results || []);
  }
  if (m === "GET" && id) {
    const r = await env.DB.prepare("SELECT * FROM " + kind + " WHERE id=?").bind(id).first();
    return r ? json(r) : json({ error: "Introuvable." }, 404);
  }
  if (m === "POST" && !id || m === "PUT" && id) {
    const b = await req.json().catch(() => ({}));
    for (const f of cfg.required) if (!clean(b[f], cfg.limits[f])) return json({ error: "Champ obligatoire : " + f }, 400);
    const vals = cfg.fields.map((f) => f === "status" ? ["draft", "pending", "published"].includes(b[f]) ? b[f] : "draft" : f === "is_magazine" ? (b[f] === "1" || b[f] === 1 || b[f] === true ? 1 : 0) : clean(b[f], cfg.limits[f]));
    if (m === "POST") {
      const newId = crypto.randomUUID(), cols = ["id", ...cfg.fields], marks = cols.map(() => "?").join(",");
      await env.DB.prepare("INSERT INTO " + kind + "(" + cols.join(",") + ") VALUES(" + marks + ")").bind(newId, ...vals).run();
      return json({ ok: true, id: newId }, 201);
    }
    await env.DB.prepare("UPDATE " + kind + " SET " + cfg.fields.map((f) => f + "=?").join(",") + ",updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(...vals, id).run();
    return json({ ok: true });
  }
  if (m === "DELETE" && id) {
    await env.DB.prepare("DELETE FROM " + kind + " WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "M\xE9thode non autoris\xE9e." }, 405);
}
__name(api, "api");
var pageRoutes = { "/": "/index.html", "/albums": "/albums.html", "/albums/": "/albums.html", "/admin": "/admin.html", "/admin/": "/admin.html", "/admin-blogueurs": "/admin-blogueurs.html", "/devenir-blogueur": "/devenir-blogueur.html", "/faire-un-don": "/faire-un-don.html", "/blogueur": "/blogueur.html", "/blogueur/": "/blogueur.html", "/qui-sommes-nous": "/qui-sommes-nous.html", "/qui-sommes-nous/": "/qui-sommes-nous.html" };
var index_default = { async fetch(req, env) {
  const u = new URL(req.url);
  try {
    if (u.pathname.startsWith("/api/")) return await api(req, env);
    const assetPath = pageRoutes[u.pathname];
    if (assetPath) {
      const assetUrl = new URL(assetPath, u.origin);
      assetUrl.search = u.search;
      const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, req));
      if (u.pathname === "/blogueur" || u.pathname === "/blogueur/") { const html=await assetResponse.text(); const previewScript=(()=>{const form=document.getElementById('article');if(!form||document.getElementById('articlePreviewButton'))return;const submit=form.querySelector('button[type="submit"],button:not([type])');if(!submit)return;submit.type='submit';submit.textContent='Soumettre pour validation';const previewButton=document.createElement('button');previewButton.type='button';previewButton.id='articlePreviewButton';previewButton.textContent='Prévisualiser l’article';previewButton.style.cssText='background:#6d35a5;color:#fff;margin-right:10px';submit.parentNode.insertBefore(previewButton,submit);const note=document.createElement('p');note.className='muted';note.style.cssText='margin-top:10px;line-height:1.6';note.textContent='Après votre soumission, l’article sera transmis à la rédaction. Il ne sera visible publiquement qu’après la validation finale du super administrateur ActuScout.';submit.parentNode.appendChild(note);const overlay=document.createElement('div');overlay.id='articlePreviewModal';overlay.style.cssText='display:none;position:fixed;inset:0;z-index:9999;background:rgba(9,5,15,.88);padding:24px;overflow:auto';const panel=document.createElement('article');panel.style.cssText='max-width:850px;margin:30px auto;background:#171320;color:#f5f0fa;border:1px solid #514064;border-radius:16px;overflow:hidden;box-shadow:0 20px 70px #000';const close=document.createElement('button');close.type='button';close.textContent='Fermer l’aperçu';close.style.cssText='margin:18px;background:#6d35a5;color:white';const hero=document.createElement('img');hero.alt='Couverture de l’article';hero.style.cssText='display:none;width:100%;max-height:390px;object-fit:cover';const content=document.createElement('div');content.style.cssText='padding:28px';const category=document.createElement('p');category.style.cssText='color:#c9a4f4;text-transform:uppercase;letter-spacing:.12em;font-size:13px';const title=document.createElement('h1');title.style.cssText='font-size:clamp(28px,5vw,42px);line-height:1.15;color:#fff';const excerpt=document.createElement('p');excerpt.style.cssText='font-size:19px;line-height:1.6;color:#c9bfd2';const body=document.createElement('div');body.style.cssText='font-size:17px;line-height:1.85;color:#eee7f4;white-space:pre-wrap;overflow-wrap:anywhere';const author=document.createElement('p');author.style.cssText='color:#b9aec8;margin-top:28px';content.append(category,title,excerpt,body,author);panel.append(close,hero,content);overlay.append(panel);document.body.append(overlay);const hide=()=>{overlay.style.display='none';document.body.style.overflow=''};close.addEventListener('click',hide);overlay.addEventListener('click',e=>{if(e.target===overlay)hide()});document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});previewButton.addEventListener('click',()=>{const data=new FormData(form);const get=n=>String(data.get(n)||'').trim();category.textContent=get('category')||'Actualité ActuScout';title.textContent=get('title')||'Titre de votre article';excerpt.textContent=get('excerpt');excerpt.style.display=excerpt.textContent?'block':'none';body.textContent=get('body')||'Le contenu de votre article apparaîtra ici.';author.textContent='Rédigé par '+(get('author')||document.getElementById('name')?.textContent||'Blogueur ActuScout');const url=get('cover_url');if(url){hero.src=url;hero.style.display='block'}else{hero.removeAttribute('src');hero.style.display='none'}overlay.style.display='block';document.body.style.overflow='hidden'});const status=document.getElementById('articleStatus');form.addEventListener('submit',()=>{if(status)status.textContent='Soumission en cours. Votre article restera privé jusqu’à la validation finale du super administrateur ActuScout.'});})();; const updated=html.replace("</body>","<script>"+previewScript+"</script></body>"); return new Response(updated,{status:assetResponse.status,statusText:assetResponse.statusText,headers:assetResponse.headers}); }
      if (u.pathname === "/admin" || u.pathname === "/admin/") {
        const html = await assetResponse.text();
        const coverField = "<label>Couverture (URL)</label><input name=\"cover_url\" type=\"url\">";
        const coverMarkup = "<div id=\"articleCoverUploadBox\" class=\"notice\" style=\"border:1px solid #e7deed;padding:16px;margin:12px 0\"><label for=\"articleCoverFile\">Téléverser une image depuis l’ordinateur</label><p class=\"muted\">JPG, PNG, WebP ou GIF — 10 Mo maximum. L’image sera stockée dans la galerie ActuScout.</p><input id=\"articleCoverFile\" type=\"file\" accept=\"image/jpeg,image/png,image/webp,image/gif\"><button type=\"button\" id=\"articleCoverUpload\">Téléverser l’image</button><p id=\"articleCoverStatus\" class=\"muted\" aria-live=\"polite\"></p><img id=\"articleCoverPreview\" alt=\"Aperçu de la couverture\" style=\"display:none;width:100%;max-height:260px;object-fit:cover;border-radius:10px;margin-top:12px\"></div>";
        const clientScript = "(()=>{const f=document.getElementById(\"articleCoverFile\"),b=document.getElementById(\"articleCoverUpload\"),s=document.getElementById(\"articleCoverStatus\"),p=document.getElementById(\"articleCoverPreview\"),u=document.querySelector('#articleForm [name=\"cover_url\"]');if(!f||!b||!s||!p||!u)return;b.addEventListener(\"click\",async()=>{const x=f.files&&f.files[0];if(!x){s.textContent=\"Sélectionne une image.\";return;}if(x.size>10485760){s.textContent=\"Limite : 10 Mo.\";return;}b.disabled=true;s.textContent=\"Téléversement en cours…\";try{const d=new FormData();d.append(\"file\",x);const r=await fetch(\"/api/article-cover-upload\",{method:\"POST\",body:d}),j=await r.json();if(!r.ok)throw Error(j.error||\"Échec du téléversement.\");u.value=j.url;p.src=j.url;p.style.display=\"block\";s.textContent=\"Couverture ajoutée. Enregistre l’article pour la conserver.\";}catch(e){s.textContent=e.message;}finally{b.disabled=false;}});f.addEventListener(\"change\",()=>{const x=f.files&&f.files[0];if(x){p.src=URL.createObjectURL(x);p.style.display=\"block\";}});if(u.value){p.src=u.value;p.style.display=\"block\";}})();";
        const articleMagazineField = "<select name=\"status\"><option value=\"draft\">Brouillon</option><option value=\"pending\">En attente de validation</option><option value=\"published\">Publié</option></select><label style=\"display:flex;align-items:center;gap:10px;padding:12px;background:#f3edf8;border-radius:8px;margin:14px 0\"><input type=\"checkbox\" name=\"is_magazine\" value=\"1\" style=\"width:auto;margin:0\"><span>Ajouter cet article au Magazine ActuScout</span></label>"; const adminSectionsScript = "(()=>{const find=t=>[...document.querySelectorAll('#app > .entry')].find(e=>e.querySelector('h2')?.textContent.trim()===t);const albums=document.getElementById('albums'),articles=document.getElementById('articles');const pc=find('Importer depuis un ordinateur'),google=find('Importer depuis Google Photos'),blogger=find('Importation des articles Blogger');const albumGrid=albums?.querySelector('.grid'),articleGrid=articles?.querySelector('.grid');if(albums&&albumGrid&&pc)albums.insertBefore(pc,albumGrid);if(albums&&albumGrid&&google)albums.insertBefore(google,albumGrid);if(blogger)blogger.remove();const cover=document.getElementById('articleCoverUploadBox');if(cover){cover.style.border='1px solid #40344e';cover.style.background='#241d30';cover.style.color='#f5f0fa';cover.style.padding='16px';cover.style.borderRadius='12px';const label=cover.querySelector('label');if(label)label.textContent='Image de couverture de l’article';}const root=document.getElementById('articleList');if(root){let previous='';const group=()=>{const cards=[...root.querySelectorAll('.entry')].filter(x=>x.querySelector('[data-edit][data-kind=\"articles\"]'));const signature=cards.map(card=>card.querySelector('p')?.textContent||'').join('|')+'#'+cards.length;if(signature===previous)return;previous=signature;const buckets={published:[],pending:[],draft:[],other:[]};cards.forEach(card=>{const status=(card.querySelector('p')?.textContent||'').split('·')[0].trim().toLowerCase();(buckets[status]||buckets.other).push(card)});root.replaceChildren();const labels={published:['Articles publiés','Visible sur ActuScout'],pending:['En attente de validation','À examiner par le super administrateur'],draft:['Brouillons','Non publiés']};['published','pending','draft','other'].forEach(key=>{const items=buckets[key];if(!items.length)return;const section=document.createElement('section');section.className='article-status-group';section.style.cssText='margin:18px 0 24px';const heading=document.createElement('div');heading.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #514064;padding:0 0 10px;margin-bottom:12px';const title=document.createElement('div');const h=document.createElement('h3');h.style.cssText='margin:0;color:#f5f0fa;font-size:18px';h.textContent=labels[key]?.[0]||'Autres articles';const sub=document.createElement('p');sub.style.cssText='margin:4px 0 0;color:#b9aec8;font-size:12px';sub.textContent=labels[key]?.[1]||'Statut à vérifier';title.append(h,sub);const count=document.createElement('span');count.style.cssText='background:#30243f;color:#d8b9f7;border:1px solid #514064;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700';count.textContent=String(items.length);heading.append(title,count);section.append(heading,...items);root.append(section)});if(!cards.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Aucun article enregistré.';root.append(empty)}};new MutationObserver(group).observe(root,{childList:true});group();}})();"; const darkThemeStyle = "<style>:root{color-scheme:dark}html,body{background:#100d18!important;color:#f5f0fa!important}body{background-image:radial-gradient(ellipse at top,#21172f 0%,#100d18 58%)!important}#app,.admin,.container,.panel,.entry,section,.card,form{background-color:#1b1725!important;color:#f5f0fa!important;border-color:#40344e!important}#app{box-shadow:0 18px 60px rgba(0,0,0,.28)}h1,h2,h3,h4,label,strong,p,span,small{color:inherit}p,.muted,.description{color:#b9aec8!important}button,.button,[type=submit]{background:#6d35a5!important;color:#fff!important;border:1px solid #8752bb!important}button:hover,.button:hover{background:#8046ba!important}button.secondary,[data-view],a.button{border-color:#514064!important}input,textarea,select{background:#171320!important;color:#f5f0fa!important;border:1px solid #514064!important}input::placeholder,textarea::placeholder{color:#9588a5!important}a{color:#c9a4f4!important}hr,.divider{border-color:#40344e!important}#articleCoverUploadBox,.notice{background:#241d30!important;color:#f5f0fa!important;border-color:#514064!important}table th,table td{border-color:#40344e!important} .hidden{display:none!important}</style>"; const themedHtml = html.replace('</head>', darkThemeStyle + '</head>'); const preparedHtml = themedHtml.replace(coverField, coverField + coverMarkup).replace("<select name=\"status\"><option value=\"draft\">Brouillon</option><option value=\"pending\">En attente de validation</option><option value=\"published\">Publié</option></select>", articleMagazineField).replace('</body>', '<script>' + clientScript + '</script><script>' + adminSectionsScript + '</script></body>');
        const navigationFix = '<script>' +
          "function showAdminSection(view) {" +
          " if (view !== 'albums' && view !== 'articles') return;" +
          " const albums = document.getElementById('albums');" +
          " const articles = document.getElementById('articles');" +
          " if (!albums || !articles) return;" +
          " albums.classList.toggle('hidden', view !== 'albums');" +
          " articles.classList.toggle('hidden', view !== 'articles');" +
          " document.querySelectorAll('[data-view]').forEach(function(item) { item.setAttribute('aria-pressed', String(item.getAttribute('data-view') === view)); });" +
          "}" +
          "function syncAdminHash() { showAdminSection(location.hash.replace('#','') || 'albums'); }" +
          "document.addEventListener('click', function(event) {" +
          " const button = event.target.closest('[data-view]'); if (!button) return;" +
          " const view = button.getAttribute('data-view'); if (view !== 'albums' && view !== 'articles') return;" +
          " event.preventDefault(); event.stopImmediatePropagation(); showAdminSection(view); history.replaceState(null, '', location.pathname + location.search + '#' + view);" +
          "}, true);" +
          "window.addEventListener('hashchange', syncAdminHash);" +
          "if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAdminHash); else syncAdminHash();" +
          "</script>";
        const patched = preparedHtml.includes('</body>') ? preparedHtml.replace('</body>', navigationFix + '</body>') : preparedHtml + navigationFix;
        return new Response(patched, { status: assetResponse.status, statusText: assetResponse.statusText, headers: assetResponse.headers });
      }
      if (u.pathname === "/" || u.pathname === "/index.html") { const html=await assetResponse.text(); const openTag=String.fromCharCode(60)+"script>"; const closeTag=String.fromCharCode(60)+"/script>"; const updated=html.replace("</body>",openTag+"(()=>{const root=document.querySelector(\"#magazine .mag-grid\");if(!root)return;fetch(\"/api/public/magazine\",{headers:{accept:\"application/json\"}}).then(r=>{if(!r.ok)throw Error(\"Magazine indisponible\");return r.json()}).then(items=>{root.replaceChildren();if(!items.length){const p=document.createElement(\"p\");p.className=\"muted\";p.textContent=\"Aucun article sélectionné pour le magazine pour le moment.\";root.append(p);return;}items.forEach(item=>{const card=document.createElement(\"article\");card.className=\"mag-card\";const art=document.createElement(\"div\");art.className=\"mag-art\";if(item.cover_url){art.style.backgroundImage=\"linear-gradient(0deg,rgba(20,8,35,.35),rgba(20,8,35,.1)),url(\"+JSON.stringify(item.cover_url)+\")\";art.style.backgroundSize=\"cover\";art.style.backgroundPosition=\"center\";}else{const strong=document.createElement(\"strong\");strong.textContent=\"MAGAZINE ACTUSCOUT\";art.append(strong);}const copy=document.createElement(\"div\");copy.className=\"mag-copy\";const k=document.createElement(\"div\");k.className=\"kicker\";k.textContent=item.category||\"Magazine ActuScout\";const h=document.createElement(\"h3\");h.textContent=item.title||\"\";const p=document.createElement(\"p\");p.textContent=item.excerpt||\"\";const a=document.createElement(\"a\");a.href=\"/article?id=\"+encodeURIComponent(item.id);a.textContent=\"Lire l’article\";copy.append(k,h,p,a);card.append(art,copy);root.append(card);});}).catch(e=>console.error(\"Magazine ActuScout:\",e));})();"+closeTag+"<script>"+"(()=>{const style=document.createElement('style');style.textContent='.album-info .gallery-thumbs,.album-info>button{display:none!important}.album{cursor:pointer}.album-info{padding:20px!important}.album-info h3{margin-top:6px!important}';document.head.append(style);const apply=()=>document.querySelectorAll('#homeAlbumGrid .album').forEach(card=>{if(card.dataset.cardOpenFix)return;card.dataset.cardOpenFix='1';card.setAttribute('role','button');card.tabIndex=0;card.setAttribute('aria-label','Ouvrir l’album '+(card.querySelector('h3')?.textContent||''));const open=()=>{const first=card.querySelector('.gallery-thumbs button');if(first)first.click();else{const source=card.querySelector('.album-info a');if(source)window.open(source.href,'_blank','noopener')}};card.addEventListener('click',e=>{if(e.target.closest('a,button'))return;open()});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})});const root=document.querySelector('#homeAlbumGrid');if(root){apply();new MutationObserver(apply).observe(root,{childList:true,subtree:true)}}})();"+"</script></body>"); const uxScript = `(()=>{const style=document.createElement('style');style.textContent='.news-card{position:relative;overflow:hidden;cursor:pointer;transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s,border-color .35s;will-change:transform}.news-card:hover{transform:translateY(-7px);box-shadow:0 18px 38px rgba(8,3,18,.32);border-color:rgba(220,195,250,.55)}.news-card .photo{overflow:hidden;transition:filter .35s}.news-card .photo:before{content:"";position:absolute;inset:0;background:inherit;background-size:cover;background-position:center;transition:transform .65s cubic-bezier(.2,.7,.2,1)}.news-card:hover .photo:before{transform:scale(1.07)}.news-card .body{transition:transform .35s}.news-card:hover .body{transform:translateY(-3px)}.news-card h3{transition:color .25s}.news-card:hover h3{color:#e2cafa}.scroll-reveal{opacity:0;transform:translateY(22px);transition:opacity .65s ease,transform .65s cubic-bezier(.2,.7,.2,1)}.scroll-reveal.is-visible{opacity:1;transform:none}.article-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.16);font-size:12px}.article-actions button{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:inherit;border-radius:20px;padding:7px 12px;cursor:pointer;font-weight:700}.article-actions button:hover{background:rgba(255,255,255,.18)}.article-actions button.liked{background:#fff;color:#321b59;border-color:#fff}.article-actions .view-count{color:#d5c6e5}.modal-inner.article-reader{max-width:920px;width:100%;max-height:calc(100vh - 40px);display:flex;flex-direction:column;overflow:hidden;padding:24px 28px}.article-reader #modalTitle{flex:0 0 auto;padding-right:35px}.article-reader #modalText{max-height:none;min-height:0;flex:1;overflow:auto;padding-right:8px}.article-reader-cover-wrap{position:relative;flex:0 0 auto;z-index:3;background:#fff;padding:0 0 12px}.article-reader-cover{display:block;width:100%;height:clamp(220px,38vh,390px);object-fit:contain;background:#211238;border-radius:4px}.article-reader .article-actions{color:#321b59;border-color:#e8e1ef;margin:10px 0 14px}.article-reader .article-actions button{color:#321b59;border-color:#d8cce5;background:#f7f3fa}.article-reader .article-actions button.liked{background:#321b59;color:#fff;border-color:#321b59}.article-reader .article-actions .view-count{color:#62566e}.article-reader-body{overflow-wrap:anywhere}.article-reader-body img{max-width:100%;height:auto;display:block;margin:16px auto}@media(max-width:680px){.article-reader.modal-inner{padding:18px 14px;max-height:calc(100vh - 20px)}.article-reader-cover{height:clamp(190px,32vh,300px)}.article-reader #modalText{padding-right:2px}}@media(prefers-reduced-motion:reduce){.news-card,.news-card .photo:before,.news-card .body,.scroll-reveal{transition:none!important;transform:none!important;opacity:1!important}}';document.head.append(style);const visitor=()=>{const key='actuscout_visitor_id',valid=id=>/^[a-zA-Z0-9-]{16,80}$/.test(id||''),make=()=>window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():'v-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);try{let id=window.localStorage.getItem(key)||'';if(!valid(id)){id=make();window.localStorage.setItem(key,id)}return id}catch(e){try{let id=window.sessionStorage.getItem(key)||'';if(!valid(id)){id=make();window.sessionStorage.setItem(key,id)}return id}catch(e2){return make()}}};const visitorId=visitor();const statsUrl=id=>'/api/public/article-engagement?id='+encodeURIComponent(id)+'&visitor_id='+encodeURIComponent(visitorId);const statsFor=async id=>{const r=await fetch(statsUrl(id),{cache:'no-store'});if(!r.ok)throw Error('Statistiques indisponibles');return r.json()};const viewFor=async id=>{const r=await fetch('/api/public/article-view',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({article_id:id,visitor_id:visitorId})});if(!r.ok)throw Error('Compteur de vues indisponible');return r.json()};const likeFor=async(id,liked)=>{const r=await fetch('/api/public/article-like',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({article_id:id,visitor_id:visitorId,liked:liked})});if(!r.ok)throw Error('Impossible d’enregistrer le like');return r.json()};const shareFor=async item=>{const url=location.origin+'/?article='+encodeURIComponent(item.id);const data={title:item.title||'Article ActuScout',text:item.excerpt||'À lire sur ActuScout',url:url};if(navigator.share){try{await navigator.share(data);return}catch(e){if(e.name==='AbortError')return}}try{await navigator.clipboard.writeText(url);alert('Lien de l’article copié.')}catch(e){prompt('Copie le lien de l’article :',url)}};const makeActions=(item,initial)=>{const bar=document.createElement('div');bar.className='article-actions';const views=document.createElement('span');views.className='view-count';views.textContent='◉ '+Number(initial.view_count||initial.views||0)+' vues';const like=document.createElement('button');like.type='button';let liked=!!(initial.liked||initial.liked_by_visitor);let likes=Number(initial.like_count||initial.likes||0);const paint=()=>{like.textContent=(liked?'♥':'♡')+' J’aime · '+likes;like.classList.toggle('liked',liked);like.setAttribute('aria-pressed',String(liked))};paint();like.addEventListener('click',async e=>{e.stopPropagation();like.disabled=true;try{const result=await likeFor(item.id,!liked);liked=!!result.liked;likes=Number(result.like_count||0);views.textContent='◉ '+Number(result.view_count||0)+' vues';paint()}catch(err){console.error(err);like.title=err.message}finally{like.disabled=false}});const share=document.createElement('button');share.type='button';share.textContent='Partager';share.addEventListener('click',e=>{e.stopPropagation();shareFor(item)});bar.append(views,like,share);return {bar,views,like,share,refresh:async()=>{try{const s=await statsFor(item.id);views.textContent='◉ '+Number(s.view_count||0)+' vues';likes=Number(s.like_count||0);liked=!!s.liked;paint()}catch(e){console.error(e)}}}};const reveal=()=>{const els=document.querySelectorAll('#actualites .news-card,#magazine .mag-card,#albums .album,.about-grid,.contact-grid');if(!('IntersectionObserver'in window)){els.forEach(e=>e.classList.add('is-visible'));return}const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12});els.forEach(e=>{if(!e.classList.contains('scroll-reveal')){e.classList.add('scroll-reveal');io.observe(e)}})};const openArticle=async item=>{const modal=document.querySelector('#infoModal'),inner=modal&&modal.querySelector('.modal-inner'),target=document.querySelector('#modalText'),title=document.querySelector('#modalTitle');if(!modal||!inner||!target||!title)return;inner.classList.add('article-reader');target.replaceChildren();const previous=inner.querySelector('.article-reader-cover-wrap');if(previous)previous.remove();if(item.cover_url){const wrap=document.createElement('div');wrap.className='article-reader-cover-wrap';const image=document.createElement('img');image.className='article-reader-cover';image.src=item.cover_url;image.alt='Couverture : '+(item.title||'article');image.loading='eager';image.decoding='async';image.onerror=()=>{wrap.remove()};wrap.append(image);inner.insertBefore(wrap,title)}title.textContent=item.title||'Article ActuScout';const actions=makeActions(item,{view_count:item.view_count,like_count:item.like_count,liked:item.liked_by_visitor});target.append(actions.bar);const body=document.createElement('div');body.className='article-reader-body';target.append(body);renderArticleBody(body,item.body||item.excerpt||'');modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';try{const result=await viewFor(item.id);actions.views.textContent='◉ '+Number(result.view_count||0)+' vues';actions.like.textContent=(result.liked?'♥':'♡')+' J’aime · '+Number(result.like_count||0);actions.like.classList.toggle('liked',!!result.liked);actions.like.setAttribute('aria-pressed',String(!!result.liked));}catch(e){console.error(e);actions.refresh()}};const load=async()=>{const root=document.querySelector('#actualites .news-grid');if(!root)return;try{const response=await fetch('/api/public/articles?visitor_id='+encodeURIComponent(visitorId),{headers:{accept:'application/json'},cache:'no-store'});if(!response.ok)throw Error('Articles indisponibles');const items=await response.json();if(!Array.isArray(items))throw Error('Réponse invalide');root.replaceChildren();if(!items.length){const p=document.createElement('p');p.textContent='Aucun article publié pour le moment.';root.append(p);return}let pending=null;items.forEach((item,index)=>{const card=document.createElement('article');card.className='news-card';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Lire : '+(item.title||'article'));if(index===0)card.classList.add('feature');const photo=document.createElement('div');photo.className='photo';photo.style.height=index===0?'260px':'190px';if(item.cover_url){const cover=document.createElement('img');cover.src=item.cover_url;cover.alt='Couverture : '+(item.title||'article');cover.loading='lazy';cover.decoding='async';cover.style.cssText='display:block;width:100%;height:100%;object-fit:cover;object-position:center';cover.onerror=()=>{cover.hidden=true;photo.style.background='linear-gradient(135deg,#35145b,#76549b)'};photo.append(cover)}else{photo.style.background='linear-gradient(135deg,#35145b,#76549b)'}const body=document.createElement('div');body.className='body';const kicker=document.createElement('div');kicker.className='kicker';kicker.textContent=item.category||'Actualité';const heading=document.createElement('h3');heading.textContent=item.title||'Article ActuScout';const excerpt=document.createElement('p');excerpt.textContent=item.excerpt||String(item.body||'').replace(/<[^>]*>/g,' ').slice(0,180);const meta=document.createElement('div');meta.className='meta';const author=document.createElement('span');author.textContent=item.author||'Rédaction ActuScout';meta.append(author);body.append(kicker,heading,excerpt,meta);const actions=makeActions(item,item);body.append(actions.bar);card.append(photo,body);const open=()=>openArticle(item);card.addEventListener('click',e=>{if(e.target.closest('.article-actions'))return;open()});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){if(e.target.closest&&e.target.closest('.article-actions'))return;e.preventDefault();open()}});root.append(card);if(!item.view_count&&!item.like_count){statsFor(item.id).then(s=>{actions.views.textContent='◉ '+Number(s.view_count||0)+' vues';actions.like.textContent=(s.liked?'♥':'♡')+' J’aime · '+Number(s.like_count||0);actions.like.classList.toggle('liked',!!s.liked)}).catch(()=>{})}if(new URLSearchParams(location.search).get('article')===String(item.id))pending=item;});reveal();if(pending)openArticle(pending)}catch(error){console.error('ActuScout — affichage des articles:',error)}};load();const mo=new MutationObserver(reveal);mo.observe(document.body,{childList:true,subtree:true});})();`;; const modalCloseFix=`(()=>{const modal=document.getElementById('infoModal'),close=document.getElementById('closeModal');if(!modal||!close)return;const hide=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';};close.type='button';close.setAttribute('aria-label','Fermer l’article');close.style.cssText+=';z-index:5;pointer-events:auto;cursor:pointer';close.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();hide()});modal.addEventListener('click',e=>{if(e.target===modal)hide()});const inner=modal.querySelector('.modal-inner');if(inner)inner.addEventListener('click',e=>e.stopPropagation());document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))hide()});const observer=new MutationObserver(()=>{if(modal.classList.contains('open')){modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}});observer.observe(modal,{attributes:true,attributeFilter:['class']});})();`; const finalHtml=updated.replace("</body>","<script>"+uxScript+"</script><script>"+modalCloseFix+"</script></body>"); return new Response(finalHtml,{status:assetResponse.status,statusText:assetResponse.statusText,headers:assetResponse.headers}); }
      return assetResponse;
    }
    return env.ASSETS.fetch(req);
const maintenancePage = () => new Response("<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>ActuScout — Maintenance</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#40215f 0,#171024 58%,#100b19 100%);color:#fff;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}.panel{width:min(100%,620px);padding:52px 38px;text-align:center;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:rgba(255,255,255,.055);box-shadow:0 24px 80px #0005}.mark{width:58px;height:58px;margin:0 auto 24px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,#9b75c8,#5b347f);font-size:25px;font-weight:800}.eyebrow{color:#c9a9eb;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}h1{font-size:clamp(28px,6vw,42px);line-height:1.12;margin:14px 0}p{color:#d4cbdc;line-height:1.75;font-size:16px;margin:14px auto;max-width:460px}.line{width:44px;height:3px;background:#b78be3;border-radius:9px;margin:28px auto 0}@media(max-width:480px){.panel{padding:40px 22px}}</style></head><body><main class=\"panel\"><div class=\"mark\">A</div><div class=\"eyebrow\">ActuScout</div><h1>Nous revenons bientôt.</h1><p>Notre site est momentanément indisponible en raison d’une intervention technique. Nos équipes travaillent au rétablissement du service.</p><p>Merci de votre patience et de votre compréhension.</p><p>Besoin de nous joindre ? Écrivez-nous à<br><a href='mailto:actuscout@gmail.com' style='color:#e0c5ff;font-weight:700;text-decoration:underline'>actuscout@gmail.com</a></p><div class=\"line\"></div></main></body></html>",{status:503,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store, no-cache, must-revalidate","retry-after":"300"}});
  } catch (e) {
    const acceptsHtml = (req.headers.get("accept") || "").includes("text/html");
    if (acceptsHtml && !new URL(req.url).pathname.startsWith("/api/")) return maintenancePage();
    return json({ error: "Erreur serveur." }, 500);
  }
} };
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
