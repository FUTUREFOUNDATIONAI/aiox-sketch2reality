# Sketch 2 Reality -- Technical Architecture

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-03-20 | @architect (Aria) | Initial architecture from PRD v1.0 |

---

## 1. System Overview

The pipeline is a linear, five-stage transformation that runs on a presenter's laptop and deploys output to Vercel.

```
                          LOCAL MACHINE (presenter laptop)
 +--------------------------------------------------------------------------+
 |                                                                          |
 |  Browser (index.html)          Express Server (:3333)                    |
 |  +------------------+          +-------------------------------------+   |
 |  |                  |  POST    |                                     |   |
 |  | 1. Upload Sketch |--------->| 2. Stitch MCP Client                |   |
 |  |    (drag/drop)   |          |    - Build JSON-RPC request         |   |
 |  |                  |          |    - Send to googleapis.com/mcp     |   |
 |  |                  |          |    - Parse SSE response             |   |
 |  |                  |          +----------------+--------------------+   |
 |  |                  |                           |                        |
 |  |                  |                           v                        |
 |  |                  |          +-------------------------------------+   |
 |  |                  |          | 3. HTML Extractor                   |   |
 |  |                  |          |    - Fetch htmlCode.downloadUrl     |   |
 |  |                  |          |    - Validate self-contained HTML   |   |
 |  |                  |          |    - Store in memory + /tmp         |   |
 |  |                  |          +----------------+--------------------+   |
 |  |                  |                           |                        |
 |  |                  |                           v                        |
 |  |                  |          +-------------------------------------+   |
 |  |                  |          | 4. Vercel Deployer                  |   |
 |  |                  |          |    - POST files to Vercel API v13   |   |
 |  |                  |          |    - Wait for READY state           |   |
 |  |                  |          |    - Return deployment URL          |   |
 |  |                  |          +----------------+--------------------+   |
 |  |                  |                           |                        |
 |  |                  |          live URL          |                        |
 |  | 5. Display       |<--------------------------+                        |
 |  |    - iframe       |                                                   |
 |  |    - URL + QR     |                                                   |
 |  +------------------+                                                    |
 |                                                                          |
 +--------------------------------------------------------------------------+
                                     |
                    Internet          |
                                     v
              +----------------------------------------------+
              |  EXTERNAL SERVICES                           |
              |                                              |
              |  Google Stitch API (stitch.googleapis.com)   |
              |  Vercel Platform API (api.vercel.com)        |
              |  Google Fonts CDN (fonts.googleapis.com)     |
              +----------------------------------------------+
```

---

## 2. Component Architecture

### 2.1 Express Server

| Attribute | Value |
|-----------|-------|
| **Responsibility** | HTTP API gateway, static file serving, pipeline orchestration |
| **Inputs** | HTTP requests from browser (JSON + multipart) |
| **Outputs** | JSON responses with screen data, HTML content, deployed URLs |
| **Port** | 3333 (configurable via `PORT` env) |
| **Dependencies** | express, multer, crypto (stdlib) |

The server is the central orchestrator. Each API endpoint triggers one or more pipeline stages and returns the final result synchronously. There is no job queue or background worker -- the HTTP request blocks until the pipeline completes (target <90s).

Key design decision: the server does NOT receive the actual sketch image for generation. The current Stitch `generate_screen_from_text` tool accepts a text prompt only. The sketch image is used for visual reference on the frontend and to inform a future `generate_screen_from_image` integration if Stitch exposes it. For now, the branding prompt drives generation.

### 2.2 Stitch MCP Client

| Attribute | Value |
|-----------|-------|
| **Responsibility** | JSON-RPC 2.0 communication with Google Stitch API over HTTPS |
| **Inputs** | Method name (`tools/call`, `initialize`), params object |
| **Outputs** | Parsed JSON-RPC result (screens, metadata) |
| **Protocol** | JSON-RPC 2.0 over HTTPS with SSE response format |
| **Auth** | `X-Goog-Api-Key` header |

The client is implemented as the `stitchMCP()` function. It handles two response formats:

1. **SSE (Server-Sent Events):** Lines prefixed with `data:`, each containing a JSON-RPC message. The client collects all `data:` lines, parses each, and returns the first message containing `.result` or `.error`.
2. **Plain JSON:** Standard JSON-RPC response body.

The `parseStitchResult()` helper extracts structured data from the `result.content[]` array, looking for `type: "text"` items with parseable JSON.

**Project Configuration:**
- Project ID: `6851128296893269757` (pre-configured with Horizon Ethos design system)
- Default model: `GEMINI_3_FLASH` (fast) with option for `GEMINI_3_1_PRO` (quality)

### 2.3 HTML Extractor

| Attribute | Value |
|-----------|-------|
| **Responsibility** | Fetch generated HTML from Stitch download URLs, ensure self-containment |
| **Inputs** | `screen.htmlCode.downloadUrl` from Stitch response |
| **Outputs** | Complete, self-contained HTML string |
| **Storage** | In-memory Map keyed by generation ID + optional `/tmp` file |

**NEW COMPONENT** -- does not exist in the prototype. Must be built for Story 1.3.

Extraction pipeline:

1. Receive Stitch screen object with `htmlCode.downloadUrl`
2. HTTP GET the download URL to fetch raw HTML
3. **Validation pass:** Ensure HTML is valid (has `<html>`, `<head>`, `<body>`)
4. **Asset inlining pass:** Scan for external CSS/JS references; inline critical ones, convert others to CDN links (Google Fonts are acceptable as external CDN)
5. **Branding verification:** Confirm FF color tokens are present in the output
6. Store HTML keyed by a generated ID (UUID or timestamp-based)
7. Serve via `GET /api/result/:id`

```
Stitch Response
    |
    v
htmlCode.downloadUrl  --->  HTTP GET  --->  Raw HTML
                                              |
                                              v
                                        Validate HTML5
                                              |
                                              v
                                        Inline assets
                                              |
                                              v
                                        Store (Map + /tmp)
                                              |
                                              v
                                        Return ID + HTML
```

### 2.4 Vercel Deployer

| Attribute | Value |
|-----------|-------|
| **Responsibility** | Deploy self-contained HTML to Vercel, return live URL |
| **Inputs** | HTML string, deployment metadata (name, timestamp) |
| **Outputs** | Live deployment URL |
| **API** | Vercel REST API v13 (`api.vercel.com`) |
| **Auth** | Bearer token via `VERCEL_TOKEN` env var |

**NEW COMPONENT** -- does not exist in the prototype. Must be built for Story 1.4.

Deployment is a two-step process using the Vercel API (not CLI):

1. **Create Deployment** -- `POST https://api.vercel.com/v13/deployments`
   - Upload the single `index.html` file
   - Set project name to pre-created Vercel project
   - Set deployment name for URL generation
2. **Poll for Ready** -- Check deployment status until `readyState === 'READY'`
3. **Return URL** -- Extract `url` from deployment response

See Section 5 for full Vercel integration strategy.

### 2.5 Frontend (Single HTML File)

| Attribute | Value |
|-----------|-------|
| **Responsibility** | Presenter-facing UI for upload, generation control, and result display |
| **Inputs** | User interactions (drag/drop, clicks), server API responses |
| **Outputs** | Visual feedback, iframe preview, deployed URL display |
| **Technology** | Single HTML file with inline CSS + JS (no build step) |
| **Design** | Split-panel layout, Future Foundation branding, 1920x1080+ optimized |

The frontend is already substantially built in the prototype. Key additions needed:

- **Deployed URL display** with copy-to-clipboard functionality
- **QR code generation** (client-side, using a lightweight library like `qrcode-generator` inlined)
- **Enhanced loading steps** that reflect actual pipeline progress (not just timed animations)
- **Variant deployment** capability (deploy any variant to its own URL)

---

## 3. Data Flow

### 3.1 Primary Pipeline: Sketch to Deployed URL

```
Step  Actor        Action                                  Data
----  -----------  --------------------------------------  ---------------------
 1    User         Drops sketch image onto upload zone     File (PNG/JPG/HEIC)
 2    Browser      Reads file, shows preview               DataURL in <img>
 3    User         Clicks GENERATE WEBSITE                 -
 4    Browser      POST /api/generate                      { deviceType, modelId }
 5    Server       stitchMCP('tools/call', {               JSON-RPC request
                     name: 'generate_screen_from_text',
                     arguments: { projectId, prompt,
                       deviceType, modelId }
                   })
 6    Stitch API   Processes prompt via Gemini model        SSE stream
 7    Server       Parses SSE, extracts screen object      { id, htmlCode, screenshot }
 8    Server       GET htmlCode.downloadUrl                 Raw HTML string
 9    Server       Validates and stores HTML                { generationId, html }
10    Server       POST api.vercel.com/v13/deployments     { files: [index.html] }
11    Vercel       Builds and deploys                      { url, readyState }
12    Server       Polls until READY                       deployment URL
13    Server       Returns response to browser             { screenId, htmlUrl,
                                                             deployedUrl, screenshot }
14    Browser      Shows iframe preview + URL + QR code    Visual output
```

### 3.2 Variant Generation Flow

```
Step  Actor        Action                                  Data
----  -----------  --------------------------------------  ---------------------
 1    User         Clicks GENERATE VARIANTS                -
 2    Browser      POST /api/generate-variants             { screenIds: [id] }
 3    Server       stitchMCP('tools/call', {               JSON-RPC request
                     name: 'generate_variants',
                     arguments: { projectId,
                       selectedScreenIds, variantOptions }
                   })
 4    Stitch API   Generates 3 REIMAGINE variants          SSE stream
 5    Server       Parses, extracts variant screens        [screen, screen, screen]
 6    Browser      Renders variant thumbnails in gallery   3 clickable previews
 7    User         Clicks variant to deploy                -
 8    Browser      POST /api/deploy-variant                { screenId, htmlUrl }
 9    Server       Fetches HTML, deploys to Vercel         New deployment URL
```

### 3.3 Polling Fallback

If the initial `/api/generate` response does not contain screen data (async generation), the frontend polls `/api/screens` every 5 seconds (up to 10 attempts) to find newly generated screens. This is the existing retry mechanism in the prototype.

---

## 4. API Design

### 4.1 POST /api/generate

Triggers the full pipeline: generate screen via Stitch, extract HTML, deploy to Vercel.

**Request:**
```json
{
  "deviceType": "DESKTOP | MOBILE | TABLET",
  "modelId": "GEMINI_3_FLASH | GEMINI_3_1_PRO",
  "prompt": "(optional) additional instructions"
}
```

**Response (success):**
```json
{
  "screenId": "abc123",
  "screenshot": {
    "downloadUrl": "https://..."
  },
  "htmlCode": {
    "downloadUrl": "https://..."
  },
  "generationId": "gen_1710936000",
  "deployedUrl": "https://ff-sketch-1710936000.vercel.app",
  "localPreviewUrl": "/api/result/gen_1710936000"
}
```

**Response (error):**
```json
{
  "error": "Stitch API timeout after 60s",
  "stage": "stitch_generation",
  "partial": null
}
```

### 4.2 POST /api/generate-variants

Generates 3 REIMAGINE variants from an existing screen.

**Request:**
```json
{
  "screenIds": ["abc123"],
  "prompt": "(optional) variant direction"
}
```

**Response (success):**
```json
{
  "variants": [
    {
      "screenId": "var1",
      "screenshot": { "downloadUrl": "https://..." },
      "htmlCode": { "downloadUrl": "https://..." }
    },
    { "..." },
    { "..." }
  ]
}
```

### 4.3 GET /api/health

Pre-demo verification of Stitch API connectivity.

**Response:**
```json
{
  "status": "ok | error",
  "projectId": "6851128296893269757",
  "server": "stitch-mcp-server",
  "vercel": "ok | not_configured",
  "timestamp": "2026-03-20T14:30:00Z"
}
```

### 4.4 GET /api/result/:id

Returns the stored generated HTML for a given generation ID. Used for local iframe preview.

**Response:** Raw HTML (`Content-Type: text/html`)

### 4.5 GET /api/screens

Lists all screens in the Stitch project. Used as polling fallback.

**Response:** Stitch screen list (passthrough from MCP response).

### 4.6 POST /api/deploy-variant (NEW)

Deploys a specific variant to Vercel independently.

**Request:**
```json
{
  "screenId": "var1",
  "htmlUrl": "https://..."
}
```

**Response:**
```json
{
  "deployedUrl": "https://ff-sketch-var1-1710936000.vercel.app"
}
```

---

## 5. Vercel Integration Strategy

### 5.1 Pre-Created Vercel Project

A single Vercel project is created once during setup. All deployments target this project, producing unique URLs per deployment.

| Setting | Value |
|---------|-------|
| Project name | `ff-sketch2reality` |
| Team | Future Foundation Vercel team (or personal account) |
| Framework | None (static HTML) |
| Build command | None |
| Output directory | `.` (root) |

### 5.2 Deployment via Vercel API (Not CLI)

The CLI is avoided because:
- It requires filesystem operations and subprocess spawning
- API calls are faster and more predictable
- No dependency on Vercel CLI installation

**Deployment flow using Vercel REST API v13:**

```
1. Compute file SHA1
   sha = sha1(htmlContent)

2. Upload file
   POST https://api.vercel.com/v2/files
   Headers: {
     Authorization: Bearer <VERCEL_TOKEN>,
     Content-Length: <size>,
     x-vercel-digest: <sha>
   }
   Body: <raw file content>

3. Create deployment
   POST https://api.vercel.com/v13/deployments
   Body: {
     name: "ff-sketch2reality",
     files: [{ file: "index.html", sha: "<sha>", size: <size> }],
     projectSettings: {
       framework: null,
       buildCommand: null,
       outputDirectory: "."
     },
     target: "production"  // or omit for preview
   }

4. Response includes deployment URL immediately
   { url: "ff-sketch2reality-<hash>.vercel.app", readyState: "QUEUED" }

5. Poll GET /v13/deployments/<id> until readyState === "READY"
   (typically 5-15 seconds for a single HTML file)
```

### 5.3 URL Pattern Strategy

Each deployment gets a unique Vercel URL automatically:

| Pattern | Example | Notes |
|---------|---------|-------|
| Auto-generated | `ff-sketch2reality-abc123.vercel.app` | Default Vercel behavior |
| Alias (optional) | `sketch-20260320-143000.ff-demos.vercel.app` | Custom via API alias |
| Custom domain | `demo-143000.futurefoundation.com` | Requires DNS setup |

**Recommended approach for demos:** Use the auto-generated URL. It is immediately available and unique. The presenter can pre-share the Vercel project dashboard URL (`vercel.com/team/ff-sketch2reality`) which shows all deployments.

For predictable pre-shareable URLs, use the Vercel alias API after deployment:
```
POST https://api.vercel.com/v2/deployments/<id>/aliases
Body: { alias: "sketch-live.ff-demos.vercel.app" }
```
This allows the presenter to share `sketch-live.ff-demos.vercel.app` before the demo -- each new deployment overwrites the alias.

### 5.4 Environment Configuration

```
VERCEL_TOKEN=<vercel-api-token>
VERCEL_PROJECT_ID=<project-id>          # from Vercel dashboard
VERCEL_TEAM_ID=<team-id>               # optional, for team projects
VERCEL_ALIAS=sketch-live.ff-demos.vercel.app  # optional, for pre-shareable URL
```

---

## 6. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 18+ | Server execution |
| Framework | Express | 4.21 | HTTP routing, middleware |
| File Upload | Multer | 1.4.5 | Multipart form handling |
| AI Generation | Google Stitch API | MCP v2025-03-26 | Screen generation via Gemini |
| AI Model | Gemini 3 Flash / 3.1 Pro | Current | Text-to-design generation |
| Deployment | Vercel API | v13 | Static site deployment |
| Frontend | HTML5 + CSS3 + Vanilla JS | - | Single-file UI, no framework |
| Fonts | Google Fonts CDN | - | Space Grotesk + Manrope |
| QR Generation | qrcode-generator (inline) | - | Client-side QR code for URLs |

**No build step.** The project has zero frontend build tooling. The HTML file is served as-is. This is intentional -- it minimizes failure points for a live demo tool.

**No database.** All state is ephemeral and held in memory. Generated HTML is stored in a `Map<string, string>` with TTL cleanup (optional). The tool is restarted fresh for each demo session.

---

## 7. Deployment Architecture

```
+---------------------------------------------------+
|  PRESENTER LAPTOP                                  |
|                                                    |
|  $ npm run dev                                     |
|  > node src/server.js                              |
|  > Server running at http://localhost:3333         |
|                                                    |
|  Browser open to http://localhost:3333             |
|  (projected to auditorium screen)                  |
+---------------------------+-----------------------+
                            |
               Internet     |
                            v
+---------------------------+-----------------------+
|  EXTERNAL SERVICES                                 |
|                                                    |
|  stitch.googleapis.com/mcp  <-- Generation         |
|  api.vercel.com              <-- Deployment         |
|  fonts.googleapis.com        <-- Font loading       |
+---------------------------------------------------+

+---------------------------------------------------+
|  AUDIENCE DEVICES                                  |
|                                                    |
|  https://ff-sketch2reality-xxx.vercel.app          |
|  (scanned via QR code, accessed on phones)         |
+---------------------------------------------------+
```

**The tool itself is never deployed.** It runs locally via `npm run dev`. Only the generated websites are deployed to Vercel.

**Pre-demo checklist:**
1. `npm run dev` -- server starts
2. Open `http://localhost:3333` -- UI loads
3. Health check passes (green dot in status bar)
4. Vercel token is set in `.env`
5. Internet connection is stable

---

## 8. Error Handling Strategy

Each pipeline stage has an independent failure mode and recovery path.

| Stage | Failure Mode | Detection | Recovery |
|-------|-------------|-----------|----------|
| **Upload** | Invalid file type | Client-side MIME check | Show "unsupported format" toast |
| **Stitch API Call** | Timeout (>60s) | `AbortController` with 60s timeout | Retry once, then show error with "Try again" button |
| **Stitch API Call** | Auth failure (401/403) | HTTP status code | Show "API key expired" -- requires restart with new key |
| **Stitch API Call** | Rate limit (429) | HTTP status code | Show "Too many requests, wait 30s" with countdown |
| **SSE Parsing** | Malformed SSE data | JSON.parse failure | Fall back to polling `/api/screens` |
| **HTML Extraction** | Download URL expired | HTTP 404/410 on fetch | Re-trigger generation |
| **HTML Extraction** | HTML not self-contained | Missing `<html>` tag check | Wrap content in minimal HTML5 boilerplate |
| **Vercel Deploy** | Auth failure | 401 from Vercel API | Show "Vercel token invalid" -- skip deploy, show local preview |
| **Vercel Deploy** | Deploy timeout | No READY after 60s polling | Show local preview URL as fallback |
| **Vercel Deploy** | Not configured | Missing `VERCEL_TOKEN` | Skip deploy stage entirely, serve via `/api/result/:id` |

**Graceful degradation principle:** If Vercel deployment fails, the pipeline still succeeds -- the user gets a local preview via iframe. The deployed URL is a bonus, not a requirement for the demo to work.

**Error response format (all endpoints):**
```json
{
  "error": "Human-readable message",
  "stage": "stitch_generation | html_extraction | vercel_deploy",
  "partial": {
    "screenId": "abc123",
    "localPreviewUrl": "/api/result/gen_123"
  }
}
```

The `partial` field allows the frontend to show whatever was successfully generated, even if later stages failed.

---

## 9. Performance Considerations

### 9.1 Target: <90 Seconds End-to-End

| Stage | Expected Duration | Notes |
|-------|-------------------|-------|
| Image upload + request | <1s | Local network only |
| Stitch API generation | 30-60s | Model-dependent (Flash ~30s, Pro ~60s) |
| HTML download | 1-3s | Single file from Google CDN |
| HTML validation/inlining | <1s | In-memory string operations |
| Vercel file upload | 1-2s | Single small file |
| Vercel deployment build | 5-15s | Static HTML, no build step |
| **Total** | **~40-80s** | Within 90s target |

### 9.2 Parallelization Opportunities

```
Sequential (cannot parallelize):
  Stitch generation --> HTML extraction --> Vercel deploy

Parallelizable:
  - Start iframe local preview WHILE Vercel deploys
  - Generate QR code WHILE polling Vercel readyState
  - Pre-warm Stitch connection on page load (health check)
  - Fetch screenshot URL in parallel with HTML download
```

The main bottleneck is the Stitch API generation (30-60s). This cannot be parallelized but can be optimized by:
- Using `GEMINI_3_FLASH` (faster) for live demos
- Pre-warming the Stitch connection via the health check on page load
- Starting the Vercel deployment immediately after HTML extraction completes (no waiting for screenshot)

### 9.3 Local Preview Optimization

To reduce perceived wait time, the frontend should show the local iframe preview (`/api/result/:id`) as soon as HTML extraction completes, without waiting for Vercel deployment. The deployed URL appears moments later as an overlay or toast notification.

```
Timeline:
  0s    User clicks GENERATE
  1s    Request hits Stitch API
  35s   Stitch returns screen data
  37s   HTML extracted, local preview shown  <-- user sees result here
  38s   Vercel upload starts (background)
  50s   Vercel URL ready, displayed + QR     <-- bonus: shareable link
```

This means the user perceives ~37s wait time, not ~50s.

### 9.4 Variant Performance

Variant generation uses the same Stitch API but requests 3 screens simultaneously via `generate_variants`. Expected time is similar to single generation (30-60s) since Stitch parallelizes internally.

---

## Appendix A: Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3333` | Express server port |
| `STITCH_API_KEY` | Yes | (hardcoded fallback) | Google Stitch API key |
| `STITCH_PROJECT_ID` | No | `6851128296893269757` | Stitch project with Horizon Ethos |
| `VERCEL_TOKEN` | Yes* | - | Vercel API bearer token |
| `VERCEL_PROJECT_ID` | No | - | Vercel project ID (auto-detected by name) |
| `VERCEL_TEAM_ID` | No | - | Vercel team scope |
| `VERCEL_ALIAS` | No | - | Pre-shareable domain alias |

*Vercel token is required for deployment. Without it, the pipeline works but skips deployment (local preview only).

## Appendix B: File Structure (Target)

```
ff-stitch/
  package.json
  .env                          # API keys (gitignored)
  .env.example                  # Template for .env
  src/
    server.js                   # Express server + pipeline orchestration
    stitch-client.js            # Stitch MCP JSON-RPC client (extracted)
    html-extractor.js           # HTML download, validation, inlining
    vercel-deployer.js          # Vercel API deployment logic
    store.js                    # In-memory HTML store (Map + TTL)
    public/
      index.html                # Frontend UI (single file)
```

The prototype's monolithic `server.js` should be refactored into focused modules. Each module maps 1:1 to a component in Section 2.
