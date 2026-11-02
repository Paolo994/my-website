# Paolo Ciotta · personal website

A personal site you explore by riding a grey Honda Hornet 750 around a pixel-art town.
Each building is a section (about, experience, case studies, AI lab, skills, passions, contact).
There is also a classic, scrollable view for people in a hurry, EN/IT switching, and an
**"Ask about me" AI assistant** backed by Spring Boot and Claude.

Technical analysis (Italian): [docs/ANALISI_TECNICA.md](docs/ANALISI_TECNICA.md).

## Structure

```
index.html            page skeleton (top bar, start screen, map, panel, classic view, chat)
css/style.css         all styles
js/content.js         ALL the site text, in English and Italian  <- edit this to change content
js/game.js            the map: world drawing, bike physics, road pathfinding, minimap
js/app.js             language, modes, section panel, fast-travel menu
js/assistant.js       "Ask about me" chat drawer
js/config.js          where the assistant backend lives
assets/               photo, social preview image, CV (PDF)

backend/              Spring Boot 3.5 / Java 21 assistant API
  src/main/resources/knowledge/profile.md   <- the ONLY facts the assistant may use
  src/main/resources/application.yml        model, limits, CORS
Dockerfile            one container: static site + API
```

## The assistant

- `POST /api/ask` `{question, history}` → `{answer, section}`; `GET /api/assistant` → `{enabled}`.
- One grounded Claude call per question (official Anthropic Java SDK). The whole profile fits in the
  prompt, so there is no retrieval step. The system prompt is cached (`cache_control`, 1h TTL).
- Structured output returns the answer plus which section of the site to open next
  ("Show me" in the chat drives the bike there).
- Guardrails: answers only from `profile.md`, says "I don't know" otherwise, stays on topic,
  treats visitor text as questions, never instructions.
- Cost/abuse protection: per-visitor limits (8/min, 40/day), a global cap (500/day), question
  length and history size limits. All configurable with env vars.
- If the backend is unreachable or has no API key, the site hides the chat button and works as before.

**What it knows**, in order of priority:
1. **The CV PDF** (`assets/cv/Paolo_Ciotta_CV_EN.pdf`): read automatically and re-read whenever the file
   changes. With Docker Compose the folder is mounted live: replace the PDF and both the download and the
   assistant use the new version immediately, no rebuild. Phone numbers are stripped before reaching the model.
2. **`backend/src/main/resources/knowledge/profile.md`**: curated facts and case studies (the CV wins on conflicts).
3. **Live GitHub repositories** of `GITHUB_USER`, refreshed every `GITHUB_REFRESH` (default 24h).

## Live content

- **CV:** see above. The CV file is not in git (it is personal); keep it locally in `assets/cv/`.
- **GitHub projects:** every public, non-fork, non-archived repository appears automatically in the Lab under
  "Fresh from GitHub" (repos with a hand-written card are listed in `CURATED` in `js/github.js`). The card uses
  the repository description; if it's empty, the first paragraph of the README. Tip: give every repo an English
  description and a few topics on GitHub, they become the card's text and tags.
- **Site text** (`js/content.js`) is hand-written and does not change by itself when the CV changes.

### Configuration (env vars)

| Variable | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | (none) | required to enable the assistant |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | model id |
| `ASSISTANT_EFFORT` | `low` | `low` / `medium` / `high` |
| `RATE_PER_MINUTE`, `RATE_PER_DAY`, `RATE_GLOBAL_PER_DAY` | 8, 40, 500 | limits |
| `ALLOWED_ORIGINS` | localhost dev servers | comma-separated, when the site is hosted elsewhere |
| `LOG_QUESTIONS` | `false` | log question text (never IPs) |
| `SITE_PORT` | `8787` | HTTP port |
| `CV_PATH` | set in Docker | CV PDF read by the assistant |
| `GITHUB_USER` | `Paolo994` | whose repositories appear in the Lab |
| `GITHUB_REFRESH` | `24h` | how often repositories are re-read (`30m`, `1h`, `24h`...) |
| `GITHUB_TOKEN` | (none) | optional, only raises GitHub's rate limit |
| `SITE_DIR` | (none) | folder with the static site to serve (set in Docker) |

## Run with Docker (recommended)

1. Put your Claude API key in `.env` (copy `.env.example` if `.env` is missing): `ANTHROPIC_API_KEY=sk-ant-...`
2. `docker compose up -d --build`
3. Open http://localhost:8787

`.env` is ignored by git and excluded from the Docker image: the key is passed to the container only at runtime.
After changing `.env`, apply it with `docker compose up -d` (no rebuild needed). Logs: `docker compose logs -f`.

## Run locally without Docker

Site only: open `index.html` (double-click). Everything works except the assistant.

Site + assistant:

```powershell
cd backend
$env:ANTHROPIC_API_KEY = "sk-ant-..."
mvn spring-boot:run            # API on http://localhost:8787
```

Then serve the site from a local web server (for example open `index.html` from IntelliJ, or
`npx serve .` in the project folder). `js/config.js` points local pages at `http://localhost:8787`.

Tests: `cd backend && mvn test`.

## Deploy

**Option A, one container (simplest):** build the `Dockerfile` and deploy it on any container host
(Render, Fly.io, Railway, a VPS). Set `ANTHROPIC_API_KEY`, and `SITE_PORT` if the host requires a
specific port. Site and API share the same origin, so no CORS setup is needed.

```
docker build -t paolo-site .
docker run -p 8787:8787 -e ANTHROPIC_API_KEY=sk-ant-... paolo-site
```

**Option B, split:** static site on GitHub Pages, backend container elsewhere. Put the backend URL in
`js/config.js` (`apiBase`) and set `ALLOWED_ORIGINS=https://paolo994.github.io` on the backend.

For link previews on LinkedIn and in email, set `og:image` in `index.html` to the absolute URL of
`assets/img/og.jpg` once you know the final domain.

## Controls

- Desktop: WASD / arrow keys to ride, click anywhere to auto-ride there, E (or Enter) to enter a building, M for the map menu, Esc to close.
- Mobile: tap anywhere to ride there, tap a building to ride to it and open it.
