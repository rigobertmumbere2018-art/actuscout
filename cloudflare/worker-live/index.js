var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));

// src/index.js
var COOKIE = "as_admin";
var enc = new TextEncoder();
var json = /* @__PURE__ */ __name((d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } }), "json");
var clean = /* @__PURE__ */ __name((v, n = 1e5) => typeof v === "string" ? v.trim().slice(0, n) : "", "clean");
var ARTICLE_HTML_TAGS = /* @__PURE__ */ new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "figure",
  "figcaption",
  "hr",
  "pre",
  "code",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "sup",
  "sub",
  "span",
  "div"
]);
var ARTICLE_DROP_CONTENT_TAGS = /* @__PURE__ */ new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "svg",
  "math",
  "template",
  "noscript"
]);
function safeArticleUrl(value, kind) {
  const v = String(value || "").trim();
  if (!v || /[\u0000-\u0020]/.test(v)) return "";
  if (kind === "href" && /^mailto:[^\s]+$/i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")) return v;
  if (v.startsWith("#") && kind === "href") return v;
  return "";
}
__name(safeArticleUrl, "safeArticleUrl");
async function sanitizeArticleHtml(value) {
  const html = String(value || "").slice(0, 1e5);
  const response = new HTMLRewriter().on("*", {
    element(element) {
      const tag = element.tagName.toLowerCase();
      if (ARTICLE_DROP_CONTENT_TAGS.has(tag)) {
        element.remove();
        return;
      }
      if (!ARTICLE_HTML_TAGS.has(tag)) {
        element.removeAndKeepContent();
        return;
      }
      const attrs = Object.entries(element.attributes || {}).map(([name, value2]) => ({ name, value: value2 }));
      for (const attr of attrs) element.removeAttribute(attr.name);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const value2 = attr.value;
        if (name === "href" && tag === "a") {
          const url = safeArticleUrl(value2, "href");
          if (url) element.setAttribute("href", url);
        } else if (name === "src" && tag === "img") {
          const url = safeArticleUrl(value2, "src");
          if (url) element.setAttribute("src", url);
        } else if (["alt", "title"].includes(name) && ["a", "img", "th", "td", "span", "div"].includes(tag)) {
          element.setAttribute(name, value2.slice(0, 500));
        } else if (name === "class" && /^[a-zA-Z0-9 _-]{1,120}$/.test(value2)) {
          element.setAttribute("class", value2);
        } else if (["width", "height", "colspan", "rowspan"].includes(name) && /^\\d{1,4}$/.test(value2)) {
          element.setAttribute(name, value2);
        }
      }
      if (tag === "img" && !element.getAttribute("src")) element.remove();
    }
  }).transform(new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" }
  }));
  return await response.text();
}
__name(sanitizeArticleHtml, "sanitizeArticleHtml");
var b64 = /* @__PURE__ */ __name((b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64");
async function mac(secret, v) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", k, enc.encode(v)));
}
__name(mac, "mac");
async function readerIdentity(req, env) {
  const raw = (req.headers.get("Cookie") || "").split(";").map((x) => x.trim()).find((x) => x.startsWith("as_reader="));
  if (raw) {
    const [id2, sig2] = raw.slice("as_reader=".length).split(".");
    if (id2 && sig2 && sig2 === await mac(env.SESSION_SECRET || "", id2)) return { id: id2, setCookie: null };
  }
  const id = crypto.randomUUID(), sig = await mac(env.SESSION_SECRET || "", id);
  return { id, setCookie: "as_reader=" + id + "." + sig + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000" };
}
__name(readerIdentity, "readerIdentity");
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
var config = { albums: { fields: ["title", "description", "event_date", "source_url", "cover_url", "status"], required: ["title"], limits: { title: 180, description: 5e3, event_date: 60, source_url: 2e3, cover_url: 2e3, status: 20 } }, articles: { fields: ["title", "category", "excerpt", "body", "cover_url", "author", "status"], required: ["title", "body"], limits: { title: 220, category: 100, excerpt: 1e3, body: 1e5, cover_url: 2e3, author: 120, status: 20 } } };
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
var BLOGGER_PERMISSIONS = ["write_articles", "edit_own_articles", "publish_articles", "manage_albums", "manage_carousel", "feature_articles", "import_word", "manage_bloggers"];
var TRAINING_LESSONS = ["workspace", "article", "word", "photos", "external", "submit"];
async function bloggerCan(env, id, key) {
  const row = await env.DB.prepare("SELECT enabled FROM blogger_permissions WHERE blogger_id=? AND permission=?").bind(id, key).first();
  return !!row?.enabled;
}
__name(bloggerCan, "bloggerCan");
async function bloggerTraining(env, id) {
  const r = await env.DB.prepare("SELECT lesson_key FROM blogger_training WHERE blogger_id=?").bind(id).all();
  const done = new Set((r.results || []).map((x) => x.lesson_key));
  return { lessons: TRAINING_LESSONS.map((key) => ({ key, completed: done.has(key) })), complete: TRAINING_LESSONS.every((key) => done.has(key)) };
}
__name(bloggerTraining, "bloggerTraining");
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
__name(escapeHtml, "escapeHtml");
var ACTUSCOUT_FROM = /* @__PURE__ */ __name((env) => env.ACTUSCOUT_EMAIL_FROM || "ActuScout - R\xE9daction <redaction@actuscout.com>", "ACTUSCOUT_FROM");
async function sendActuScoutMail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" }, body: JSON.stringify({ from: ACTUSCOUT_FROM(env), to, subject, html }) });
  return response.ok;
}
__name(sendActuScoutMail, "sendActuScoutMail");
async function withPasswordTools(response) {
  if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) return response;
  let html = await response.text();
  const script = `<style>.as-password-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}.as-password-tools button{font:inherit;cursor:pointer}.as-toggle-password{border:1px solid #d7cde1;border-radius:7px;background:transparent;color:inherit;padding:7px 11px}.as-forgot-password{border:0;background:transparent;color:#35145b;text-decoration:underline;padding:6px 0}</style><script>(()=>{document.querySelectorAll('input[type="password"]').forEach(input=>{if(input.dataset.asPasswordReady)return;input.dataset.asPasswordReady='1';const wrap=document.createElement('div');wrap.className='as-password-tools';const toggle=document.createElement('button');toggle.type='button';toggle.className='as-toggle-password';toggle.textContent='Afficher le mot de passe';toggle.addEventListener('click',()=>{const visible=input.type==='password';input.type=visible?'text':'password';toggle.textContent=visible?'Masquer le mot de passe':'Afficher le mot de passe'});input.insertAdjacentElement('afterend',wrap);wrap.appendChild(toggle);const form=input.closest('form');if(form&&(form.id==='loginForm'||form.querySelector('input[name="email"],input[name="username"]'))&&!form.querySelector('.as-forgot-password')){const forgot=document.createElement('button');forgot.type='button';forgot.className='as-forgot-password';forgot.textContent='Mot de passe oubli\xE9 ?';forgot.addEventListener('click',async()=>{const emailField=form.querySelector('input[name="email"],input[name="username"]');const email=(emailField?.value||prompt('Adresse e-mail du compte ActuScout :')||'').trim();if(!email)return;try{const r=await fetch('/api/password/forgot',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});const d=await r.json();if(!r.ok)throw Error(d.error||'Demande impossible');alert(d.message+' Consulte ta bo\xEEte e-mail.');const code=prompt('Saisis le code re\xE7u par e-mail :');if(!code)return;const password=prompt('Nouveau mot de passe (10 caract\xE8res minimum) :');if(!password)return;const confirm=prompt('Confirme le nouveau mot de passe :');if(password!==confirm){alert('Les deux mots de passe ne correspondent pas.');return}const rr=await fetch('/api/password/reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,token:code,password})});const result=await rr.json();if(!rr.ok)throw Error(result.error||'R\xE9initialisation impossible');alert(result.message)}catch(e){alert(e.message)}});wrap.appendChild(forgot)}})})()<\/script>`;
  if (!html.includes("as-password-tools")) html = html.replace("</body>", script + "</body>");
  return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
}
__name(withPasswordTools, "withPasswordTools");
async function api(req, env) {
  const u = new URL(req.url), p = u.pathname, m = req.method;
  const gr = await googleRoutes(req, env, u);
  if (gr) return gr;
  if (p === "/api/newsletter/subscribe" && m === "POST") {
    const b = await req.json().catch(() => ({})), email = clean(b.email, 254).toLowerCase(), consent = b.consent === true, trap = clea

--- TRUNCATED ---
Response was ~39,562 tokens (limit: 6,000). Use more specific queries to reduce response size.