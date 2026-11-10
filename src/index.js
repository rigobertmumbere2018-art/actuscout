const COOKIE='as_admin', enc=new TextEncoder();
const json=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...h}});
const clean=(v,n=100000)=>typeof v==='string'?v.trim().slice(0,n):'';
function sanitizeArticleHtml(value) {
  let html = String(value || '').slice(0, 100000);
  html = html.replace(/<\s*(script|iframe|object|embed|form|input|button|textarea|style|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  html = html.replace(/<\s*(script|iframe|object|embed|form|input|button|textarea|style|link|meta)\b[^>]*\/?\s*>/gi, '');
  html = html.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/\s+(href|src)\s*=\s*(["'])\s*(javascript|vbscript|data:text\/html):[\s\S]*?\2/gi, ' $1="#"');
  return html;
}

const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function mac(secret,v){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(await crypto.subtle.sign('HMAC',k,enc.encode(v)))}
async function readerIdentity(req,env){
 const raw=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('as_reader='));
 if(raw){
  const [id,sig]=raw.slice('as_reader='.length).split('.');
  if(id&&sig&&sig===await mac(env.SESSION_SECRET||'',id))return {id,setCookie:null};
 }
 const id=crypto.randomUUID(),sig=await mac(env.SESSION_SECRET||'',id);
 return {id,setCookie:'as_reader='+id+'.'+sig+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000'};
}
async function makeSession(env,u){const p=b64(enc.encode(JSON.stringify({u,exp:Date.now()+28800000})));return p+'.'+await mac(env.SESSION_SECRET,p)}
async function authorized(req,env){const c=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));if(!c||!env.SESSION_SECRET)return false;const [p,s]=c.slice(COOKIE.length+1).split('.');if(!p||!s||s!==await mac(env.SESSION_SECRET,p))return false;try{const v=JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));return !!v.u&&v.exp>Date.now()}catch{return false}}
const config={albums:{fields:['title','description','event_date','source_url','cover_url','status'],required:['title'],limits:{title:180,description:5000,event_date:60,source_url:2000,cover_url:2000,status:20}},articles:{fields:['title','category','excerpt','body','cover_url','author','status'],required:['title','body'],limits:{title:220,category:100,excerpt:1000,body:100000,cover_url:2000,author:120,status:20}}};

const GOOGLE_SCOPE='https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/drive.readonly';
const GOOGLE_TOKEN_ID='admin';
const b64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
function redirect(url,headers={}){return new Response(null,{status:302,headers:{Location:url,...headers}})}
async function googleAccess(env){const row=await env.DB.prepare('SELECT encrypted_refresh_token FROM google_oauth_tokens WHERE id=?').bind(GOOGLE_TOKEN_ID).first();if(!row)return null;const refresh=await decryptToken(env,row.encrypted_refresh_token);const form=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'});const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});const d=await r.json();if(!r.ok)throw new Error('Google OAuth: '+(d.error_description||d.error||'refresh failed'));return d.access_token}
async function encryptToken(env,value){const key=await crypto.subtle.digest('SHA-256',enc.encode(env.GOOGLE_TOKEN_ENCRYPTION_KEY));const aes=await crypto.subtle.importKey('raw',key,'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,enc.encode(value));return b64url(iv)+'.'+b64url(ct)}
async function decryptToken(env,value){const [iv,ct]=value.split('.');const key=await crypto.subtle.digest('SHA-256',enc.encode(env.GOOGLE_TOKEN_ENCRYPTION_KEY));const aes=await crypto.subtle.importKey('raw',key,'AES-GCM',false,['decrypt']);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},aes,unb64(ct)))}
async function googleApi(path,token,init={}){const r=await fetch('https://photospicker.googleapis.com/v1/'+path,{...init,headers:{Authorization:'Bearer '+token,...(init.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error?.message||'Erreur Google Photos');return d}
async function googleRoutes(req,env,u){const p=u.pathname,m=req.method;
 if(p==='/api/google/status'&&m==='GET'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const r=await env.DB.prepare('SELECT id FROM google_oauth_tokens WHERE id=?').bind(GOOGLE_TOKEN_ID).first();return json({connected:!!r})}
 if(p==='/api/google/connect'&&m==='GET'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_TOKEN_ENCRYPTION_KEY)return json({error:'Configuration Google OAuth manquante.'},503);const state=b64url(crypto.getRandomValues(new Uint8Array(24)));const cb=u.origin+'/api/google/callback';const q=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:cb,response_type:'code',scope:GOOGLE_SCOPE,access_type:'offline',prompt:'consent',state});return redirect('https://accounts.google.com/o/oauth2/v2/auth?'+q.toString(),{'Set-Cookie':'gp_state='+state+'; HttpOnly; Secure; SameSite=Lax; Path=/api/google; Max-Age=600'})}
 if(p==='/api/google/callback'&&m==='GET'){if(!await authorized(req,env))return new Response('Session administrateur requise.',{status:401});const state=u.searchParams.get('state'),cookie=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('gp_state='))?.slice(9);if(!state||state!==cookie)return new Response('État OAuth invalide.',{status:400});if(u.searchParams.get('error'))return redirect('/admin?google=cancelled');const form=new URLSearchParams({code:u.searchParams.get('code')||'',client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:u.origin+'/api/google/callback',grant_type:'authorization_code'});const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});const d=await r.json();if(!r.ok||!d.refresh_token)return new Response('Google n’a pas fourni de jeton de renouvellement. Recommencez la connexion en autorisant l’accès.',{status:400});const encrypted=await encryptToken(env,d.refresh_token);await env.DB.prepare("INSERT INTO google_oauth_tokens(id,encrypted_refresh_token) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET encrypted_refresh_token=excluded.encrypted_refresh_token,updated_at=CURRENT_TIMESTAMP").bind(GOOGLE_TOKEN_ID,encrypted).run();return redirect('/admin?google=connected',{'Set-Cookie':'gp_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/google; Max-Age=0'})}
 if(p==='/api/google/picker'&&m==='POST'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const b=await req.json().catch(()=>({}));const album=await env.DB.prepare('SELECT id FROM albums WHERE id=?').bind(clean(b.album_id,100)).first();if(!album)return json({error:'Album introuvable.'},404);const token=await googleAccess(env);if(!token)return json({error:'Connecte d’abord Google Photos.'},409);const d=await googleApi('sessions',token,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({})});await env.DB.prepare('INSERT INTO google_picker_sessions(id,album_id) VALUES(?,?)').bind(d.id,album.id).run();return json({sessionId:d.id,pickerUri:d.pickerUri,pollInterval:d.pollingConfig?.pollInterval||'3s',timeoutIn:d.pollingConfig?.timeoutIn||'300s'})}
 
if(p==='/api/google/drive-import'&&m==='POST'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const b=await req.json().catch(()=>({})),albumId=clean(b.album_id,100),folder=clean(b.folder_id,200);if(!albumId||!folder)return json({error:'Album et identifiant du dossier Drive obligatoires.'},400);const album=await env.DB.prepare('SELECT id FROM albums WHERE id=?').bind(albumId).first();if(!album)return json({error:'Album introuvable.'},404);const token=await googleAccess(env);if(!token)return json({error:'Connecte ou reconnecte Google pour autoriser Drive.'},409);let pageToken='',imported=0,skipped=0,cover='';do{const q=new URLSearchParams({q:"'"+folder+"' in parents and trashed=false",pageSize:'100',fields:'nextPageToken,files(id,name,mimeType)',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});if(pageToken)q.set('pageToken',pageToken);const lr=await fetch('https://www.googleapis.com/drive/v3/files?'+q.toString(),{headers:{Authorization:'Bearer '+token}});const ld=await lr.json().catch(()=>({}));if(!lr.ok)throw new Error(ld.error?.message||'Impossible de lire le dossier Google Drive');for(const file of ld.files||[]){const existing=await env.DB.prepare('SELECT id FROM album_photos WHERE google_media_id=?').bind('drive:'+file.id).first();if(existing){skipped++;continue}const mime=file.mimeType||'';if(!mime.startsWith('image/')&&!mime.startsWith('video/')){skipped++;continue}const fr=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media',{headers:{Authorization:'Bearer '+token}});if(!fr.ok){skipped++;continue}const ext=(file.name.split('.').pop()|| (mime==='image/jpeg'?'jpg':'bin')).toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin';const key='albums/'+albumId+'/'+crypto.randomUUID()+'.'+ext;await env.GALLERY.put(key,fr.body,{httpMetadata:{contentType:mime}});const url=(env.R2_PUBLIC_BASE||'').replace(/\/$/,'')+'/'+key;await env.DB.prepare('INSERT INTO album_photos(id,album_id,object_key,public_url,mime_type,google_media_id) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),albumId,key,url,mime,'drive:'+file.id).run();if(!cover&&mime.startsWith('image/'))cover=url;imported++}pageToken=ld.nextPageToken||''}while(pageToken);if(cover)await env.DB.prepare("UPDATE albums SET cover_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (cover_url IS NULL OR cover_url='')").bind(cover,albumId).run();return json({ok:true,imported,skipped,message:imported+' fichier(s) importé(s) depuis Google Drive.'})}

if(p==='/api/google/import'&&m==='POST'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const b=await req.json().catch(()=>({}));const sess=await env.DB.prepare('SELECT * FROM google_picker_sessions WHERE id=?').bind(clean(b.session_id,200)).first();if(!sess)return json({error:'Session de sélection introuvable.'},404);const token=await googleAccess(env);const status=await googleApi('sessions/'+encodeURIComponent(sess.id),token);if(!status.mediaItemsSet)return json({ready:false,message:'Sélection Google Photos pas encore terminée.'},202);let pageToken='',imported=0,cover='';do{const q=new URLSearchParams({sessionId:sess.id,pageSize:'100'});if(pageToken)q.set('pageToken',pageToken);const list=await googleApi('mediaItems?'+q.toString(),token);for(const item of list.mediaItems||[]){const mediaId=clean(item.id,300);if(!mediaId)continue;const existing=await env.DB.prepare('SELECT id FROM album_photos WHERE google_media_id=?').bind(mediaId).first();if(existing)continue;const mf=item.mediaFile||{},mime=mf.mimeType||'image/jpeg';if(!mime.startsWith('image/')&&!mime.startsWith('video/'))continue;const suffix=mime.startsWith('video/')?'=dv':'=d';const response=await fetch(mf.baseUrl+suffix,{headers:{Authorization:'Bearer '+token}});if(!response.ok)continue;const ext=(mime.split('/')[1]||'jpg').replace('jpeg','jpg').replace(/[^a-z0-9]/gi,'');const key='albums/'+sess.album_id+'/'+crypto.randomUUID()+'.'+ext;await env.GALLERY.put(key,response.body,{httpMetadata:{contentType:mime}});const base=env.R2_PUBLIC_BASE||'';const url=base.replace(/\/$/,'')+'/'+key;const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO album_photos(id,album_id,object_key,public_url,mime_type,google_media_id) VALUES(?,?,?,?,?,?)').bind(id,sess.album_id,key,url,mime,mediaId).run();if(!cover&&mime.startsWith('image/'))cover=url;imported++}pageToken=list.nextPageToken||''}while(pageToken);if(cover)await env.DB.prepare('UPDATE albums SET cover_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (cover_url IS NULL OR cover_url=\'\')').bind(cover,sess.album_id).run();await env.DB.prepare('DELETE FROM google_picker_sessions WHERE id=?').bind(sess.id).run();await googleApi('sessions/'+encodeURIComponent(sess.id),token,{method:'DELETE'}).catch(()=>{});return json({ready:true,imported,coverUrl:cover})}
 return null}


const BLOG_COOKIE='as_blogger';
async function makeBloggerSession(env,id){const p=b64(enc.encode(JSON.stringify({id,exp:Date.now()+28800000})));return p+'.'+await mac(env.SESSION_SECRET,p)}
async function bloggerAuthorized(req,env){const c=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(BLOG_COOKIE+'='));if(!c||!env.SESSION_SECRET)return null;const [p,s]=c.slice(BLOG_COOKIE.length+1).split('.');if(!p||!s||s!==await mac(env.SESSION_SECRET,p))return null;try{const v=JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));if(v.exp<Date.now())return null;return await env.DB.prepare("SELECT id,name,email,phone,status FROM bloggers WHERE id=? AND status='active'").bind(v.id).first()}catch{return null}}

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function sendActuScoutMail(env,to,subject,html){if(!env.RESEND_API_KEY||!env.ACTUSCOUT_EMAIL_FROM)return false;const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:env.ACTUSCOUT_EMAIL_FROM,to,subject,html})});return response.ok}

async function api(req,env){const u=new URL(req.url),p=u.pathname,m=req.method;const gr=await googleRoutes(req,env,u);if(gr)return gr;
if(p==='/api/article-media'&&m==='POST'){
 const admin=await authorized(req,env),blogger=admin?null:await bloggerAuthorized(req,env);
 if(!admin&&!blogger)return json({error:'Connexion requise.'},401);
 if(!env.GALLERY||!env.R2_PUBLIC_BASE)return json({error:'Stockage R2 non configuré.'},503);
 const form=await req.formData(),file=form.get('file');
 if(!file||typeof file.arrayBuffer!=='function'||!file.size)return json({error:'Choisis une image à envoyer.'},400);
 if(file.size>10*1024*1024)return json({error:'Image trop volumineuse : limite de 10 Mo.'},413);
 const mime=(file.type||'').toLowerCase(),types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
 if(!types[mime])return json({error:'Format image non accepté. Utilise JPG, PNG, WebP, GIF ou AVIF.'},415);
 const owner=blogger?blogger.id:'admin',key='articles/'+owner+'/'+crypto.randomUUID()+'.'+types[mime];
 await env.GALLERY.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:mime}});
 return json({ok:true,url:env.R2_PUBLIC_BASE.replace(/\\/$/,'')+'/'+key,key},201);
}
if(p==='/api/upload'&&m==='POST'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);if(!env.GALLERY||!env.R2_PUBLIC_BASE)return json({error:'Stockage R2 non configuré.'},503);const form=await req.formData();const file=form.get('file'),albumId=clean(form.get('album_id'),100);if(!file||typeof file.arrayBuffer!=='function'||!file.size)return json({error:'Choisis un fichier à envoyer.'},400);if(file.size>10*1024*1024)return json({error:'Fichier trop volumineux : limite de 10 Mo.'},413);const mime=file.type||'application/octet-stream';if(!mime.startsWith('image/')&&!mime.startsWith('video/'))return json({error:'Seules les images et vidéos sont acceptées.'},415);const album=await env.DB.prepare('SELECT id FROM albums WHERE id=?').bind(albumId).first();if(!album)return json({error:'Album introuvable.'},404);const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin';const key='albums/'+albumId+'/'+crypto.randomUUID()+'.'+ext;await env.GALLERY.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:mime}});const url=env.R2_PUBLIC_BASE.replace(/\/$/,'')+'/'+key;const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO album_photos(id,album_id,object_key,public_url,mime_type) VALUES(?,?,?,?,?)').bind(id,albumId,key,url,mime).run();if(mime.startsWith('image/'))await env.DB.prepare("UPDATE albums SET cover_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (cover_url IS NULL OR cover_url='')").bind(url,albumId).run();return json({ok:true,id,url,key},201)}

if(p==='/api/blogger/apply'&&m==='POST'){
 const f=await req.formData(),name=clean(f.get('name'),160),email=clean(f.get('email'),200).toLowerCase(),phone=clean(f.get('phone'),60),city=clean(f.get('city'),120),motivation=clean(f.get('motivation'),5000),file=f.get('cv');
 if(!name||!email||!phone||!motivation||!file||!file.size)return json({error:'Tous les champs et le CV PDF sont obligatoires.'},400);
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return json({error:'Adresse e-mail invalide.'},400);
 if(file.type!=='application/pdf'||file.size>5*1024*1024)return json({error:'Le CV doit être un PDF de 5 Mo maximum.'},400);
 if(await file.slice(0,5).text()!=='%PDF-')return json({error:'Le fichier transmis ne possède pas une signature PDF valide.'},415);
 const account=await env.DB.prepare('SELECT id,status FROM bloggers WHERE email=? COLLATE NOCASE').bind(email).first();if(account)return json({error:account.status==='active'?'Un compte blogueur existe déjà avec cette adresse. Connecte-toi à ton espace blogueur.':'Cette adresse est déjà associée à un compte blogueur suspendu. Contacte la rédaction ActuScout.'},409);
 const duplicate=await env.DB.prepare("SELECT id FROM blogger_applications WHERE email=? COLLATE NOCASE AND status='pending'").bind(email).first();if(duplicate)return json({error:'Une candidature en attente existe déjà pour cette adresse.'},409);
 if(!env.GALLERY)return json({error:'Le stockage des candidatures est temporairement indisponible.'},503);
 const id=crypto.randomUUID(),key='candidatures/'+id+'.pdf';await env.GALLERY.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:'application/pdf'}});
 let saved;try{saved=await env.DB.prepare("INSERT INTO blogger_applications(id,name,email,phone,city,motivation,cv_key,status) SELECT ?,?,?,?,?,?,?,'pending' WHERE NOT EXISTS(SELECT 1 FROM blogger_applications WHERE email=? COLLATE NOCASE AND status='pending') AND NOT EXISTS(SELECT 1 FROM bloggers WHERE email=? COLLATE NOCASE)").bind(id,name,email,phone,city,motivation,key,email,email).run()}catch(error){await env.GALLERY.delete(key).catch(()=>{});throw error}if(!saved.meta?.changes){await env.GALLERY.delete(key);const account=await env.DB.prepare('SELECT status FROM bloggers WHERE email=? COLLATE NOCASE').bind(email).first();return json({error:account?(account.status==='active'?'Un compte blogueur existe déjà avec cette adresse. Connecte-toi à ton espace blogueur.':'Cette adresse est déjà associée à un compte blogueur suspendu. Contacte la rédaction ActuScout.'):'Une candidature en attente existe déjà pour cette adresse.'},409)}
 return json({ok:true,message:'Candidature reçue. Elle sera examinée par la rédaction ActuScout.'},201)
}
if(p==='/api/blogger/login'&&m==='POST'){const b=await req.json().catch(()=>({})),email=clean(b.email,200).toLowerCase(),password=typeof b.password==='string'?b.password.slice(0,300):'';const row=await env.DB.prepare("SELECT id,name,email,phone,status,password_hash FROM bloggers WHERE email=? AND status='active'").bind(email).first();if(!row||!env.SESSION_SECRET||await mac(env.SESSION_SECRET,password)!==row.password_hash)return json({error:'Identifiants incorrects ou compte non activé.'},401);const {password_hash,...profile}=row;return json({ok:true,blogger:profile},200,{'set-cookie':BLOG_COOKIE+'='+await makeBloggerSession(env,row.id)+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800'})}
if(p==='/api/blogger/logout'&&m==='POST')return json({ok:true},200,{'set-cookie':BLOG_COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
if(p==='/api/blogger/password'&&m==='POST'){
 const blogger=await bloggerAuthorized(req,env);if(!blogger)return json({error:'Connexion blogueur requise.'},401);
 const b=await req.json().catch(()=>({})),current=typeof b.current_password==='string'?b.current_password.slice(0,300):'',next=typeof b.new_password==='string'?b.new_password.slice(0,300):'';
 if(next.length<10)return json({error:'Le nouveau mot de passe doit contenir au moins 10 caractères.'},400);
 const row=await env.DB.prepare("SELECT password_hash FROM bloggers WHERE id=? AND status='active'").bind(blogger.id).first();
 if(!row||!env.SESSION_SECRET||await mac(env.SESSION_SECRET,current)!==row.password_hash)return json({error:'Mot de passe actuel incorrect.'},401);
 await env.DB.prepare('UPDATE bloggers SET password_hash=? WHERE id=?').bind(await mac(env.SESSION_SECRET,next),blogger.id).run();
 return json({ok:true,message:'Mot de passe modifié.'});
}
if(p.startsWith('/api/blogger/')){
 const blogger=await bloggerAuthorized(req,env);if(!blogger)return json({error:'Connexion blogueur requise.'},401);
 if(p==='/api/blogger/me'&&m==='GET')return json(blogger);
 const articleRoute=p.match(/^\\/api\\/blogger\\/articles(?:\\/([^/]+))?$/);
 if(articleRoute){
  const id=articleRoute[1];
  if(m==='GET'&&!id){const rows=await env.DB.prepare('SELECT id,title,category,excerpt,status,created_at,updated_at FROM articles WHERE blogger_id=? ORDER BY created_at DESC').bind(blogger.id).all();return json(rows.results||[])}
  if(m==='GET'&&id){const row=await env.DB.prepare('SELECT id,title,category,excerpt,body,cover_url,author,status,created_at,updated_at FROM articles WHERE id=? AND blogger_id=?').bind(id,blogger.id).first();return row?json(row):json({error:'Article introuvable.'},404)}
  if(m==='POST'||(m==='PUT'&&id)){
   const b=await req.json().catch(()=>({})),title=clean(b.title,220),body=sanitizeArticleHtml(b.body);
   if(!title||!body.replace(/<[^>]*>/g,'').trim())return json({error:'Titre et contenu obligatoires.'},400);
   const status=b.status==='pending'?'pending':'draft',category=clean(b.category,100),excerpt=clean(b.excerpt,1000),cover=clean(b.cover_url,2000);
   if(m==='POST'){const newId=crypto.randomUUID();await env.DB.prepare('INSERT INTO articles(id,title,category,excerpt,body,cover_url,author,status,blogger_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(newId,title,category,excerpt,body,cover,blogger.name,status,blogger.id).run();return json({ok:true,id:newId,status,message:status==='pending'?'Article transmis à la rédaction pour validation.':'Brouillon enregistré.'},201)}
   const result=await env.DB.prepare('UPDATE articles SET title=?,category=?,excerpt=?,body=?,cover_url=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND blogger_id=?').bind(title,category,excerpt,body,cover,status,id,blogger.id).run();
   if(!result.meta?.changes)return json({error:'Article introuvable ou accès refusé.'},404);
   return json({ok:true,id,status,message:status==='pending'?'Article transmis à la rédaction pour validation.':'Brouillon enregistré.'});
  }
  return json({error:'Méthode non autorisée.'},405);
 }
 return json({error:'Route blogueur introuvable.'},404);
}
if(p==='/api/admin/blogger-applications'&&m==='GET'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const r=await env.DB.prepare('SELECT id,name,email,phone,city,motivation,status,cv_key,created_at FROM blogger_applications ORDER BY created_at DESC').all();return json((r.results||[]).map(a=>({...a,cv_url:'/api/admin/blogger-applications/'+a.id+'/cv'})))}
if(p==='/api/admin/bloggers'&&m==='GET'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const r=await env.DB.prepare('SELECT id,name,email,phone,status,created_at FROM bloggers ORDER BY created_at DESC').all();return json(r.results||[])}
const cvMatch=p.match(/^\/api\/admin\/blogger-applications\/([^/]+)\/cv$/);
if(cvMatch&&m==='GET'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const a=await env.DB.prepare('SELECT cv_key FROM blogger_applications WHERE id=?').bind(cvMatch[1]).first();if(!a)return json({error:'CV introuvable.'},404);const obj=await env.GALLERY.get(a.cv_key);return obj?new Response(obj.body,{headers:{'content-type':'application/pdf','content-disposition':'inline; filename="CV-candidat.pdf"','cache-control':'no-store'}}):json({error:'Fichier CV absent.'},404)}
const reviewMatch=p.match(/^\/api\/admin\/articles\/([^/]+)\/publish$/);
if(reviewMatch&&m==='POST'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const result=await env.DB.prepare("UPDATE articles SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(reviewMatch[1]).run();if(!result.meta?.changes)return json({error:'Cet article a déjà été traité ou n’existe plus dans les articles en attente.'},409);return json({ok:true,message:'Article validé et publié.'})}
const rejectMatch=p.match(/^\/api\/admin\/articles\/([^/]+)\/reject$/);
if(rejectMatch&&m==='POST'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const result=await env.DB.prepare("UPDATE articles SET status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(rejectMatch[1]).run();if(!result.meta?.changes)return json({error:'Cet article a déjà été traité ou n’existe plus dans les articles en attente.'},409);return json({ok:true,message:'Article renvoyé en brouillon.'})}
const bloggerStatus=p.match(/^\/api\/admin\/bloggers\/([^/]+)\/status$/);
if(bloggerStatus&&m==='POST'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const b=await req.json().catch(()=>({}));if(!['active','suspended'].includes(b.status))return json({error:'Statut invalide.'},400);const x=await env.DB.prepare('UPDATE bloggers SET status=? WHERE id=?').bind(b.status,bloggerStatus[1]).run();if(!x.meta?.changes)return json({error:'Compte blogueur introuvable.'},404);return json({ok:true})}
const appDecision=p.match(/^\/api\/admin\/blogger-applications\/([^/]+)\/decision$/);
if(appDecision&&m==='POST'){if(!await authorized(req,env))return json({error:'Authentification requise.'},401);const b=await req.json().catch(()=>({})),status=b.status;if(!['accepted','rejected'].includes(status))return json({error:'Décision invalide.'},400);const a=await env.DB.prepare('SELECT * FROM blogger_applications WHERE id=?').bind(appDecision[1]).first();if(!a)return json({error:'Candidature introuvable.'},404);if(a.status!=='pending')return json({error:'Cette candidature a déjà été traitée.'},409);if(status==='accepted'&&!env.SESSION_SECRET)return json({error:'Configuration de sécurité manquante : impossible de créer le compte.'},503);if(status==='accepted'){const temp=crypto.randomUUID().replace(/-/g,'')+'Aa1!';const hash=await mac(env.SESSION_SECRET,temp);const results=await env.DB.batch([env.DB.prepare("INSERT INTO bloggers(id,name,email,phone,password_hash,status,application_id) SELECT ?,?,?,?,?,'active',? WHERE EXISTS(SELECT 1 FROM blogger_applications WHERE id=? AND status='pending') AND NOT EXISTS(SELECT 1 FROM bloggers WHERE email=? COLLATE NOCASE)").bind(crypto.randomUUID(),a.name,a.email,a.phone,hash,a.id,a.id,a.email),env.DB.prepare("UPDATE blogger_applications SET status='accepted',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM bloggers WHERE application_id=? AND email=?)").bind(a.id,a.id,a.email)]);if(!results[0]?.meta?.changes){const existing=await env.DB.prepare('SELECT id FROM bloggers WHERE email=?').bind(a.email).first();if(existing)return json({error:'Cette adresse e-mail est déjà associée à un compte blogueur. Aucun mot de passe n’a été modifié.'},409);return json({error:'Cette candidature vient d’être traitée par une autre session. Actualise la liste.'},409)}if(!results[1]?.meta?.changes)return json({error:'La création du compte n’a pas pu être confirmée. Réessaie après actualisation.'},409);let emailSent=false;try{emailSent=await sendActuScoutMail(env,a.email,'Votre candidature ActuScout est acceptée','<p>Bonjour '+escapeHtml(a.name)+',</p><p>Votre candidature a été acceptée.</p><p>Accès à l’espace blogueur : <a href="https://actuscout.rigobertmumbere2018.workers.dev/blogueur">ouvrir votre espace</a>.</p><p>Mot de passe temporaire : <b>'+escapeHtml(temp)+'</b></p><p>Connectez-vous puis modifiez immédiatement ce mot de passe depuis la rubrique Sécurité du compte.</p>')}catch{}if(emailSent)return json({ok:true,emailSent:true,message:'Compte créé. Les identifiants ont été envoyés à l’adresse e-mail du candidat. Il devra modifier son mot de passe dès sa première connexion.'});return json({ok:true,emailSent:false,temporaryPassword:temp,message:'Compte créé, mais l’e-mail n’a pas pu être envoyé. Transmets le mot de passe temporaire au candidat par un canal privé. Il devra le modifier dès sa première connexion.'})}const decision=await env.DB.prepare("UPDATE blogger_applications SET status='rejected',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(a.id).run();if(!decision.meta?.changes)return json({error:'Cette candidature vient d’être traitée par une autre session. Actualise la liste.'},409);return json({ok:true})}


if(p==='/api/admin/import-blogger'&&m==='POST'){
 if(!await authorized(req,env))return json({error:'Authentification administrateur requise.'},401);
 const payload=await req.json().catch(()=>null);
 if(!Array.isArray(payload)||payload.length>500)return json({error:'Fichier JSON invalide ou trop volumineux.'},400);
 let imported=0,skipped=0,drafts=0,published=0,imagesCopied=0,imagesKept=0,errors=[];
 for(const item of payload){
  const sourceId=clean(item.blogger_post_id,300),title=clean(item.title,220),body=typeof item.body==='string'?item.body.slice(0,100000):'';
  if(!sourceId||!body){skipped++;errors.push({id:sourceId||null,error:'Identifiant Blogger ou contenu manquant.'});continue}
  const exists=await env.DB.prepare('SELECT id FROM articles WHERE blogger_post_id=?').bind(sourceId).first();
  if(exists){skipped++;continue}
  const status=title?'published':'draft';
  let html=body,cover=clean(item.cover_url,2000),urls=Array.isArray(item.image_urls)?item.image_urls:[];
  const unique=[...new Set(urls.filter(x=>typeof x==='string'&&/^https:\/\//i.test(x)))];
  for(let i=0;i<unique.length;i++){
   const original=unique[i];
   if(env.GALLERY&&env.R2_PUBLIC_BASE){
    try{
     const response=await fetch(original,{redirect:'follow'});
     if(!response.ok)throw new Error('HTTP '+response.status);
     const type=(response.headers.get('content-type')||'image/jpeg').split(';')[0];
     if(!type.startsWith('image/'))throw new Error('Type média non image');
     const ext=(type.split('/')[1]||'jpg').replace('jpeg','jpg').replace(/[^a-z0-9]/gi,'').slice(0,8)||'jpg';
     const key='blogger/'+encodeURIComponent(sourceId.slice(-48))+'/'+i+'-'+crypto.randomUUID()+'.'+ext;
     await env.GALLERY.put(key,response.body,{httpMetadata:{contentType:type}});
     const replacement=env.R2_PUBLIC_BASE.replace(/\/$/,'')+'/'+key;
     html=html.split(original).join(replacement);
     if(cover===original)cover=replacement;
     imagesCopied++;
    }catch(e){imagesKept++}
   }else imagesKept++;
  }
  html=html.replace(/<\s*(script|iframe|object|embed|form|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,'')
    .replace(/\s+on[a-z]+\s*=\s*(['"][\s\S]*?\1|[^\s>]+)/gi,'')
    .replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi,'');
  try{
   await env.DB.prepare('INSERT INTO articles(id,title,category,excerpt,body,cover_url,author,status,created_at,updated_at,blogger_post_id,source_permalink,original_published_at,original_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),title,clean(item.category,100),clean(item.excerpt,1000),html,cover,clean(item.author,120)||'ActuScout',status,clean(item.original_published_at,40)||new Date().toISOString(),clean(item.original_updated_at,40)||new Date().toISOString(),sourceId,clean(item.source_permalink,2000),clean(item.original_published_at,40),clean(item.original_updated_at,40)).run();
   imported++;if(status==='published')published++;else drafts++;
  }catch(e){errors.push({id:sourceId,error:'Insertion impossible. Vérifier la migration D1 0004.'});}
 }
 return json({ok:errors.length===0,imported,skipped,published,drafts,imagesCopied,imagesKept,errors},errors.length?207:200);
}

if(p==='/api/health')return json({ok:true});
if(p==='/api/login'&&m==='POST'){const b=await req.json().catch(()=>({}));if(!env.ADMIN_USERNAME||!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return json({error:'Secrets administrateur non configurés.'},503);if(b.username!==env.ADMIN_USERNAME||b.password!==env.ADMIN_PASSWORD)return json({error:'Identifiants incorrects.'},401);return json({ok:true},200,{'set-cookie':COOKIE+'='+await makeSession(env,env.ADMIN_USERNAME)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800'})}
if(p==='/api/logout'&&m==='POST')return json({ok:true},200,{'set-cookie':COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
const ranking=u.pathname==='/api/public/rankings'&&m==='GET';
 if(ranking){const by=['views','likes','shares'].includes(u.searchParams.get('by'))?u.searchParams.get('by'):'views',limit=Math.min(20,Math.max(1,Number(u.searchParams.get('limit'))||5));const rows=await env.DB.prepare('SELECT a.id,a.title,a.category,a.cover_url,a.author,a.created_at,COALESCE(m.views,0) AS views,COALESCE(m.likes,0) AS likes,COALESCE(m.shares,0) AS shares FROM articles a LEFT JOIN article_metrics m ON m.article_id=a.id WHERE a.status=\'published\' ORDER BY '+by+' DESC,a.created_at DESC LIMIT ?').bind(limit).all();return json(rows.results||[])}
 const interaction=p.match(/^\/api\/public\/articles\/([^/]+)\/(metrics|view|like|share)$/);
 if(interaction){
  if(!env.SESSION_SECRET)return json({error:'Statistiques indisponibles : configuration de sécurité manquante.'},503);
  const articleId=decodeURIComponent(interaction[1]),action=interaction[2];
  if((action==='metrics'&&m!=='GET')||(action!=='metrics'&&m!=='POST'))return json({error:'Méthode non autorisée.'},405);
  if(action!=='metrics'){
   const origin=req.headers.get('Origin');
   if(!origin||origin!==u.origin)return json({error:'Origine de requête non autorisée.'},403);
  }
  const article=await env.DB.prepare("SELECT id FROM articles WHERE id=? AND status='published'").bind(articleId).first();
  if(!article)return json({error:'Article introuvable.'},404);
  const reader=await readerIdentity(req,env),headers=reader.setCookie?{'set-cookie':reader.setCookie}:{};
  await env.DB.prepare('INSERT OR IGNORE INTO article_metrics(article_id) VALUES(?)').bind(articleId).run();
  if(action==='view'){
   const inserted=await env.DB.prepare("INSERT OR IGNORE INTO article_views(article_id,visitor_id,view_date) VALUES(?,?,date('now'))").bind(articleId,reader.id).run();
   if(inserted.meta?.changes)await env.DB.prepare('UPDATE article_metrics SET views=views+1,updated_at=CURRENT_TIMESTAMP WHERE article_id=?').bind(articleId).run();
  }
  if(action==='like'){
   const inserted=await env.DB.prepare('INSERT OR IGNORE INTO article_likes(article_id,visitor_id) VALUES(?,?)').bind(articleId,reader.id).run();
   if(inserted.meta?.changes)await env.DB.prepare('UPDATE article_metrics SET likes=likes+1,updated_at=CURRENT_TIMESTAMP WHERE article_id=?').bind(articleId).run();
   else{
    const removed=await env.DB.prepare('DELETE FROM article_likes WHERE article_id=? AND visitor_id=?').bind(articleId,reader.id).run();
    if(removed.meta?.changes)await env.DB.prepare('UPDATE article_metrics SET likes=MAX(0,likes-1),updated_at=CURRENT_TIMESTAMP WHERE article_id=?').bind(articleId).run();
   }
  }
  if(action==='share'){
   const eventId=crypto.randomUUID();
   await env.DB.batch([
    env.DB.prepare('INSERT INTO article_share_events(id,article_id,reader_id) VALUES(?,?,?)').bind(eventId,articleId,reader.id),
    env.DB.prepare('UPDATE article_metrics SET shares=shares+1,updated_at=CURRENT_TIMESTAMP WHERE article_id=?').bind(articleId)
   ]);
  }
  const stats=await env.DB.prepare('SELECT views,likes,shares FROM article_metrics WHERE article_id=?').bind(articleId).first();
  const liked=!!await env.DB.prepare('SELECT 1 AS yes FROM article_likes WHERE article_id=? AND visitor_id=?').bind(articleId,reader.id).first();
  return json({...stats,liked},200,headers);
 }
 if(p==='/api/public/albums'&&m==='GET'){const r=await env.DB.prepare("SELECT id,title,description,event_date,source_url,cover_url,status,created_at,updated_at FROM albums WHERE status='published' ORDER BY created_at DESC").all();const rows=r.results||[];await Promise.all(rows.map(async a=>{try{const ph=await env.DB.prepare('SELECT id,public_url,mime_type,created_at FROM album_photos WHERE album_id=? ORDER BY created_at ASC').bind(a.id).all();a.photos=ph.results||[]}catch(e){a.photos=[];a.photos_error=true}}));return json(rows)}
const pub=p.match(/^\/api\/public\/(albums|articles)$/);if(pub&&m==='GET'){const k=pub[1],r=await env.DB.prepare("SELECT * FROM "+k+" WHERE status='published' ORDER BY created_at DESC").all();return json(r.results||[])}
if(!await authorized(req,env))return json({error:'Authentification requise.'},401);if(p==='/api/me')return json({authenticated:true});
const match=p.match(/^\/api\/(albums|articles)(?:\/([^/]+))?$/);if(!match)return json({error:'Route introuvable.'},404);const kind=match[1],id=match[2],cfg=config[kind];
if(m==='GET'&&!id){const r=await env.DB.prepare('SELECT * FROM '+kind+' ORDER BY created_at DESC').all();return json(r.results||[])}
if(m==='GET'&&id){const r=await env.DB.prepare('SELECT * FROM '+kind+' WHERE id=?').bind(id).first();return r?json(r):json({error:'Introuvable.'},404)}
if((m==='POST'&&!id)||(m==='PUT'&&id)){const b=await req.json().catch(()=>({}));for(const f of cfg.required)if(!clean(b[f],cfg.limits[f]))return json({error:'Champ obligatoire : '+f},400);const vals=cfg.fields.map(f=>f==='status'?(['draft','pending','published'].includes(b[f])?b[f]:'draft'):(f==='body'?sanitizeArticleHtml(b[f]):clean(b[f],cfg.limits[f])));if(m==='POST'){const newId=crypto.randomUUID(),cols=['id',...cfg.fields],marks=cols.map(()=>'?').join(',');await env.DB.prepare('INSERT INTO '+kind+'('+cols.join(',')+') VALUES('+marks+')').bind(newId,...vals).run();return json({ok:true,id:newId},201)}await env.DB.prepare('UPDATE '+kind+' SET '+cfg.fields.map(f=>f+'=?').join(',')+',updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(...vals,id).run();return json({ok:true})}
if(m==='DELETE'&&id){await env.DB.prepare('DELETE FROM '+kind+' WHERE id=?').bind(id).run();return json({ok:true})}return json({error:'Méthode non autorisée.'},405)}
const pageRoutes={'/redaction':'/editor/index.html','/redaction/':'/editor/index.html','/':'/index.html','/albums':'/albums.html','/albums/':'/albums.html','/admin':'/admin.html','/admin/':'/admin.html','/admin-blogueurs':'/admin-blogueurs.html','/devenir-blogueur':'/devenir-blogueur.html','/faire-un-don':'/faire-un-don.html','/blogueur':'/blogueur.html','/blogueur/':'/blogueur.html','/article':'/article.html','/article/':'/article.html','/qui-sommes-nous':'/qui-sommes-nous.html','/qui-sommes-nous/':'/qui-sommes-nous.html'};
export default {async fetch(req,env){const u=new URL(req.url);try{if(u.pathname.startsWith('/api/'))return await api(req,env);const assetPath=pageRoutes[u.pathname];if(assetPath){const assetUrl=new URL(assetPath,u.origin);assetUrl.search=u.search;return env.ASSETS.fetch(new Request(assetUrl,req))}return env.ASSETS.fetch(req)}catch(e){return json({error:'Erreur serveur.'},500)}}};
