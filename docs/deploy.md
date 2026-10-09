# Deploying Funda Scanner

Funda Scanner is a static single-page app. `npm run build` writes everything to `dist/`; there is no
server and no environment secret. Any static host works. Two things matter:

1. **Base path.** Set `VITE_BASE` at build time to the path the site is served from.
   `/` (the default) for a domain root, `/<repo>/` for a GitHub Pages project site.
   It must start and end with a slash; a missing slash is added for you.
2. **Deep links.** `/screener` or `/company/ABC` must return the app, not a 404, when opened directly
   or reloaded. The build also writes `dist/404.html` (a copy of `index.html`) for hosts that serve a
   404 page for unknown paths (GitHub Pages). Other hosts need a rewrite rule, shown below.

```bash
npm ci
VITE_BASE=/ npm run build          # domain root
VITE_BASE=/my-repo/ npm run build  # sub-path
npm run preview                    # try the build locally
```

## GitHub Pages (project site)

The repository ships `.github/workflows/pages.yml`. It builds on every push to `main` (and on
demand with "Run workflow") and deploys with the official Pages actions.

1. In the repository, open **Settings -> Pages -> Build and deployment -> Source** and choose
   **GitHub Actions**.
2. Push to `main`. The workflow builds with `VITE_BASE=/<repository name>/`, so the site appears at
   `https://<user>.github.io/<repository name>/`.
3. Direct links such as `.../screener` first receive GitHub's `404.html` response, which is the app
   itself, so the page still loads and the router shows the right screen. Browsers show the page
   normally; only the HTTP status is 404.

Notes:

- `index.html` names an absolute `og:image` (`https://mrchartist.github.io/Funda-Scanner-Base-Project/og-image.png`).
  Social cards need an absolute URL, so edit those two lines (`og:image`, `twitter:image`) if the site
  lives at another address.
- A user or organisation site (`https://<user>.github.io/`, repository named `<user>.github.io`) is
  served from the root: set the repository variable `VITE_BASE` to `/`
  (**Settings -> Secrets and variables -> Actions -> Variables**).

## Custom domain

Serve from the root of the domain, so build with `VITE_BASE=/`.

- **GitHub Pages:** add the domain under **Settings -> Pages -> Custom domain**, create the DNS
  record GitHub shows, and set the repository variable `VITE_BASE` to `/` so the workflow builds for
  the root. Commit nothing else; the domain is stored in the Pages settings (a `CNAME` file in
  `public/` is also accepted).
- Update the two `og:image` / `twitter:image` URLs in `index.html` to the new address.

## Netlify, Vercel, Cloudflare Pages

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output / publish directory | `dist` |
| Node version | 20 or newer (`.nvmrc` says 20) |
| Environment variable | `VITE_BASE=/` (the default, so it can be left out) |

Single-page fallback:

- **Netlify and Cloudflare Pages** read `public/_redirects`, which is copied to `dist/_redirects`:
  `/*    /index.html   200`. Cloudflare Pages also serves `index.html` for unknown paths on its own when
  there is no `404.html`; if you keep `404.html`, the `_redirects` rule takes precedence.
- **Vercel:** add `vercel.json` next to `package.json`:

  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

  Files that exist (assets, icons, sample data) are served first, so the rule only catches app routes.

## Docker / nginx

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_BASE=/
ENV VITE_BASE=$VITE_BASE
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf` (root deployment; for a sub-path build, change `location /` to `location /my-repo/` and
use `try_files $uri /my-repo/index.html;`):

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # Hashed assets never change: cache for a year.
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  # index.html and the manifest must always be revalidated.
  location = /index.html { add_header Cache-Control "no-cache"; }
  location = /manifest.json { add_header Cache-Control "no-cache"; }

  # Single-page app: unknown paths get the app.
  location / {
    try_files $uri $uri/ /index.html;
  }

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
}
```

```bash
docker build -t funda-scanner .
docker run --rm -p 8080:80 funda-scanner
```

## Checking a build

- `VITE_BASE=/repo/ npm run build`, then serve `dist/` under `/repo/` with a static server that
  answers unknown paths with `404.html`. Open `/repo/`, `/repo/screener` and
  `/repo/company/<symbol>` directly: each should show the app, and the network panel should show no
  failed requests.
- CI does a sub-path build on every push (`.github/workflows/ci.yml`).
- First load: the entry script is about 45 KB gzip, with the vendor chunks (React, router, query,
  Radix UI, motion) cached separately. Recharts loads only on pages that draw charts, and the
  importer (zod, parsers, validation) loads only when you import a file.

## Where the base path is used in the code

- `vite.config.ts` reads `VITE_BASE` and sets Vite's `base`; it also writes `dist/404.html`.
- `src/lib/base-path.ts` exports `ROUTER_BASENAME` (for `<BrowserRouter basename>`) and `assetUrl()`
  (for files in `public/`, for example the CSV templates). Never write `"/sample-data/..."` by hand.
- `public/manifest.json` uses relative URLs, so the installed app works under any base.
