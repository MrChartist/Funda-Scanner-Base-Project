# Security Policy

## Supported versions

Only the latest commit on `main` is supported.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's private
[Report a vulnerability](https://github.com/MrChartist/Funda-Scanner-Base-Project/security/advisories/new)
form instead. Include steps to reproduce and the impact you see. You can expect an
acknowledgement within a few days.

## Notes for deployers

- This project is a front-end only. It stores preferences, watchlists, portfolio entries
  and saved screens in the browser's `localStorage`; nothing is sent to a server by default.
- Never put secrets in `VITE_*` variables — Vite embeds them in the public JavaScript bundle.
- If you connect a data provider, serve it over HTTPS and check its licence before redistributing data.
