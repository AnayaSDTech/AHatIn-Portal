# Deploying the AHat website on Hostinger

The website (the React frontend) is a set of static files served by Hostinger at **https://ahat.in**. It talks to the backend on Render at **https://api.ahat.in**. Sign-in cookies are shared by the two addresses (cookie domain `.ahat.in`), so signing in works across both.

Deploy the backend on Render first (see `docs/DEPLOY_RENDER.md`), then the website.

---

## 1. Point api.ahat.in at Render

1. Render → **ahat-backend** → **Settings** → **Custom Domains** → **Add** `api.ahat.in`. Render shows a target such as `ahat-backend.onrender.com`.
2. Hostinger → **Domains** → `ahat.in` → **DNS / Nameservers** → **Add record**:

| Type | Name | Target | TTL |
|---|---|---|---|
| CNAME | `api` | the target Render showed (e.g. `ahat-backend.onrender.com`) | default |

3. Back in Render, wait until the domain shows **Verified** and the certificate is issued (a few minutes, sometimes up to an hour).
4. Check `https://api.ahat.in/api/health` shows `{"status":"ok"}`.

Leave the existing DNS records for email (Resend's records for `ahat.in`) untouched.

## 2. Build the website

On your computer, in the `frontend` folder:

```
npm ci
npm run build:hostinger
```

This builds the website with the settings in `frontend/.env.production` (API at `https://api.ahat.in`, demo hints on) and creates **`frontend/ahat-frontend.zip`**. The zip holds the files at its top level, including `.htaccess`.

## 3. Upload to Hostinger

1. Hostinger → **Websites** → `ahat.in` → **File Manager** → open **`public_html`**.
2. Delete what's there (e.g. Hostinger's default `default.php` / `index.php`). Keep nothing from older uploads: old files can show an old version.
3. **Upload** `ahat-frontend.zip`, then right-click it → **Extract** into `public_html` (not into a sub-folder).
4. Delete the zip. `public_html` should now contain `index.html`, `.htaccess`, `assets/`, `sw.js` and the icons. (`.htaccess` is a hidden file; turn on "Show hidden files" to see it.)
5. Hostinger → **Security** → **SSL**: make sure the certificate for `ahat.in` is active.

What `.htaccess` does:
- sends everyone to `https://ahat.in` (from `http://` and from `www.`);
- makes links like `https://ahat.in/dashboard/documents` open the app (instead of "404 Not Found");
- adds security headers, caches the built files for a year and never caches `index.html` and the service worker, so updates show up straight away;
- keeps the site out of search results (`X-Robots-Tag: noindex`) while it has demo content. Delete that line in `frontend/public/.htaccess` when you go live with real content, then rebuild and upload.

## 4. Allow uploads from ahat.in

Backblaze → **Buckets** → `ahat-documents` → **CORS Rules**: allow `https://ahat.in` and `https://www.ahat.in` (methods `PUT` and `GET`; headers `content-type` and `x-amz-server-side-encryption`). Without it, students can't upload documents.

## 5. Check it works

On https://ahat.in:

1. The home page opens; `http://ahat.in` and `https://www.ahat.in` both end up on `https://ahat.in`.
2. Log in with `demo.student@ahatin.example` (the code appears on screen), refresh the page on `/dashboard/documents`: it stays signed in and doesn't show "404".
3. Staff sign in → "Use" next to the counsellor → Continue → "Fill it in".
4. As the student, upload a 50–200 KB PDF; as the counsellor, open it with **View**.
5. Register with a real email address you own: the code arrives by email and isn't shown on screen.

---

## Updating the website later

1. Make the changes, then `npm run build:hostinger` in `frontend`.
2. In `public_html`, delete all the files, then upload and extract the new `ahat-frontend.zip`.
3. Visitors get the new version automatically the next time they open or refresh the site.

## If something doesn't work

| Symptom | Likely cause |
|---|---|
| "404 Not Found" when refreshing a page other than the home page | `.htaccess` missing from `public_html` (hidden file not uploaded or extracted into a sub-folder) |
| Sign-in fails, or "Something went wrong" everywhere | `api.ahat.in` not verified on Render yet, or the Render service is asleep (free plan: the first request after 15 quiet minutes takes about a minute) |
| Signed in, but every change says "Your session has expired" | `COOKIE_DOMAIN` on Render isn't `.ahat.in` |
| Document upload fails | The Backblaze CORS rule for `https://ahat.in` is missing |
| Old version still showing | Old files left in `public_html`; delete everything and extract the zip again |
