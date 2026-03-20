# Sketch 2 Reality — Product Requirements Document (PRD)

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-03-20 | @pm (Morgan) / Orion | Initial PRD based on prototype conversation |

---

## 1. Goals and Background Context

### 1.1 Goals

- Deliver a live demo tool that transforms hand-drawn sketches into fully branded, navigable websites in real-time
- Create a "UAU factor" moment during live presentations/palestras — audience watches sketch become reality
- Automate the entire pipeline: sketch upload → branded design → generated website → deployed URL
- Showcase Future Foundation's AI capabilities and technical authority in strategic consulting
- Provide a reusable demo asset for conferences, client meetings, and sales presentations

### 1.2 Background Context

Future Foundation is a strategic consulting firm that wants to demonstrate AI-powered web generation during live presentations. The concept is simple but powerful: invite an audience member to draw a website on paper, take a photo, and within seconds transform that sketch into a professional, branded, navigable website — deployed live with a shareable URL.

A working prototype already exists using Google Stitch API (MCP) with a Node.js/Express backend and a premium dark-mode UI. The prototype successfully generates branded screens via Gemini models but lacks the end-to-end automation: image-to-website generation, automatic code extraction, and Vercel deployment with pre-established links.

### 1.3 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-20 | 1.0 | Initial PRD creation from prototype conversation | Orion |

---

## 2. Requirements

### 2.1 Functional Requirements

- **FR1:** The system SHALL accept image uploads (PNG, JPG, HEIC) of hand-drawn sketches via drag-and-drop or file browser
- **FR2:** The system SHALL transform the uploaded sketch image into a professional website design using Google Stitch API + Gemini, applying Future Foundation branding automatically (colors: #006EEB primary, #0c1322 surface; fonts: Space Grotesk uppercase headings, Manrope body; dark mode)
- **FR3:** The system SHALL generate a complete, navigable one-pager HTML website from the Stitch-generated design
- **FR4:** The system SHALL automatically deploy the generated website to Vercel using a pre-established subdomain pattern (e.g., `sketch-{id}.futurefoundation.vercel.app` or similar)
- **FR5:** The system SHALL return the live deployed URL to the user within the interface immediately after deployment
- **FR6:** The system SHALL display real-time progress feedback during generation (analyzing sketch → applying branding → generating code → deploying)
- **FR7:** The system SHALL support device type selection (Desktop, Mobile, Tablet) for the generated output
- **FR8:** The system SHALL provide a "Generate Variants" feature that creates 3 REIMAGINE variants of the generated design with completely different layouts while maintaining brand identity
- **FR9:** The system SHALL display the generated website in a live preview iframe within the interface
- **FR10:** The system SHALL support both dark and light mode generation for the output websites

### 2.2 Non-Functional Requirements

- **NFR1:** End-to-end generation time (upload → deployed URL) MUST be under 90 seconds for a single screen
- **NFR2:** The interface MUST be visually premium and stage-ready — suitable for projection on large screens during live events
- **NFR3:** The system MUST work reliably on a single laptop with internet connection (no complex infrastructure)
- **NFR4:** The Vercel deployment link MUST be pre-established/predictable so the presenter can share it before the demo starts
- **NFR5:** The system SHOULD gracefully handle Stitch API timeouts or failures with clear user feedback
- **NFR6:** The generated websites MUST be valid HTML5, responsive, and include all CSS inline (single-file deployment)
- **NFR7:** The interface MUST handle screen resolutions of 1920x1080 and above for stage projection

---

## 3. User Interface Design Goals

### 3.1 Overall UX Vision

A split-panel interface designed for maximum visual impact on stage. Left panel is the "sketch world" (analog, raw, human), right panel is the "reality world" (digital, polished, AI-generated). The transformation moment — when the right panel lights up with a professional website — is the core emotional beat.

### 3.2 Key Interaction Paradigms

- **Drag & Drop First:** Primary interaction is dragging a photo onto the upload zone
- **One-Click Generation:** Single button triggers the entire pipeline
- **Progressive Disclosure:** Loading states show each step (analyzing → branding → rendering → deploying)
- **Instant Gratification:** Live preview appears in iframe, deployed URL is displayed and copyable

### 3.3 Core Screens and Views

1. **Main Interface (Split Panel)** — Upload zone (left) + Output preview (right) + Controls (bottom)
2. **Loading Overlay** — Animated step-by-step progress with branded visuals
3. **Result View** — Live iframe preview + deployed URL + variant generation option
4. **Variants Gallery** — 3 reimagined versions side by side

### 3.4 Accessibility

None (demo tool, not production SaaS)

### 3.5 Branding

- **Company:** Future Foundation
- **Design System:** "Horizon Ethos" (auto-generated by Stitch)
- **Primary Color:** #006EEB (vibrant blue)
- **Surface Colors:** #0c1322 (dark), #141b2b (container-low), #232a3a (container-high)
- **Text:** #dce2f7 (luminous white)
- **Headlines:** Space Grotesk, ALL UPPERCASE, tracking +2%
- **Body:** Manrope
- **Borders:** None — tonal surface layering only
- **Border Radius:** 4px max (sharp, authoritative)
- **Navigation:** Glassmorphic with backdrop-blur
- **CTA Gradient:** #aec6ff → #006eeb at 135deg
- **Style:** McKinsey meets Silicon Valley — premium, futuristic, jaw-dropping

### 3.6 Target Device and Platforms

Desktop Only (stage presentation tool projected on large screens, 1920x1080+)

---

## 4. Technical Assumptions

### 4.1 Repository Structure

Monorepo — single project, simple structure

### 4.2 Service Architecture

Serverless-oriented monolith:
- **Backend:** Node.js + Express (existing prototype)
- **Frontend:** Single HTML file with inline CSS/JS (existing prototype)
- **AI Engine:** Google Stitch API via MCP protocol (REST over HTTPS)
- **AI Model:** Gemini 3 Flash (fast) / Gemini 3.1 Pro (quality)
- **Deployment Target:** Vercel (for generated websites) + local dev server (for the tool itself)
- **Stitch Project ID:** `6851128296893269757` (pre-configured with Horizon Ethos design system)

### 4.3 Testing Requirements

Minimal — this is a demo tool:
- Manual testing of the upload → generate → deploy flow
- API health check endpoint for pre-demo verification
- No unit tests required for MVP

### 4.4 Additional Technical Assumptions

- Google Stitch API key is available and configured (`X-Goog-Api-Key` header)
- Vercel CLI or API is available for automated deployment
- Pre-established Vercel project with custom domain/subdomain for predictable URLs
- Generated HTML must be self-contained (inline CSS, no external dependencies beyond CDN fonts)
- The tool runs locally on the presenter's laptop — not deployed as a hosted service
- Internet connection is required (Stitch API + Vercel deployment)

---

## 5. Epic List

### Epic 1: Core Pipeline — Sketch to Deployed Website

**Goal:** Establish the complete end-to-end pipeline: upload sketch → generate branded design via Stitch → extract HTML → deploy to Vercel → return live URL. This epic delivers the core demo capability.

### Epic 2: Stage Experience — Polish & Variants

**Goal:** Elevate the interface for live stage presentation: loading animations, variant generation, result gallery, and URL display. Make every moment on stage visually impressive.

---

## 6. Epic Details

### Epic 1: Core Pipeline — Sketch to Deployed Website

The foundation epic that delivers the entire automated pipeline. After this epic, a presenter can upload a sketch photo and receive a live, deployed website URL.

#### Story 1.1: Express Server with Stitch MCP Proxy

As a **presenter**,
I want a backend server that proxies requests to Google Stitch API,
so that the frontend can trigger sketch-to-design generation.

**Acceptance Criteria:**
1. Express server starts on configurable port (default 3333)
2. `POST /api/generate` accepts JSON with `deviceType` and `modelId`, calls Stitch MCP `generate_screen_from_text` with Future Foundation branding prompt
3. Server correctly handles Stitch MCP SSE (Server-Sent Events) responses and returns parsed JSON
4. `GET /api/health` returns connection status to Stitch API
5. Branding prompt is pre-configured with all Future Foundation design tokens (colors, fonts, style)
6. Server handles errors gracefully and returns structured error JSON

#### Story 1.2: Upload Interface with Branded UI

As a **presenter**,
I want a premium dark-mode upload interface,
so that the demo looks professional on stage.

**Acceptance Criteria:**
1. Split-panel layout: left (INPUT / SKETCH) + right (OUTPUT / REALITY)
2. Drag-and-drop zone accepts PNG, JPG, HEIC images
3. Browse Files button as alternative upload method
4. Device type toggle: Desktop / Mobile / Tablet
5. Image preview displays in upload zone after selection
6. GENERATE WEBSITE button is disabled until an image is uploaded
7. Clear button resets the interface
8. Status bar shows Stitch connection status (green dot = connected)
9. All typography uses Space Grotesk (uppercase headings) + Manrope (body)
10. Future Foundation branding applied: #006EEB primary, #0c1322 background

#### Story 1.3: HTML Code Extraction from Stitch Response

As a **presenter**,
I want the system to extract the generated HTML code from Stitch API responses,
so that it can be deployed as a standalone website.

**Acceptance Criteria:**
1. Parse Stitch response to extract `htmlCode.downloadUrl` from generated screens
2. Fetch the HTML content from the download URL
3. Ensure HTML is self-contained (inline CSS, CDN fonts only)
4. If HTML references external assets, inline them or use CDN equivalents
5. Store generated HTML temporarily for deployment
6. `GET /api/result/:id` returns the generated HTML for preview

#### Story 1.4: Automatic Vercel Deployment

As a **presenter**,
I want generated websites to automatically deploy to Vercel with a predictable URL,
so that I can share the link with the audience immediately.

**Acceptance Criteria:**
1. Vercel project is pre-configured with a known subdomain pattern
2. After HTML generation, system automatically creates a Vercel deployment
3. Deployment uses Vercel API (not CLI) for speed and reliability
4. Deployment completes within 30 seconds
5. Returned URL follows predictable pattern (e.g., `sketch-{timestamp}.vercel.app`)
6. `POST /api/generate` response includes the deployed URL
7. System supports pre-established custom domain if configured

#### Story 1.5: End-to-End Integration & Live Preview

As a **presenter**,
I want the full pipeline connected: upload → generate → extract → deploy → preview,
so that one button press does everything.

**Acceptance Criteria:**
1. GENERATE WEBSITE button triggers complete pipeline
2. Right panel shows live iframe preview of the deployed website
3. Deployed URL is displayed below the preview, copyable to clipboard
4. Loading overlay shows real-time progress steps
5. Error states display clear messages without breaking the interface
6. Pipeline completes in under 90 seconds for a single screen

---

### Epic 2: Stage Experience — Polish & Variants

Elevate the demo from functional to spectacular. Add variant generation, improve animations, and ensure every aspect is stage-ready.

#### Story 2.1: REIMAGINE Variant Generation

As a **presenter**,
I want to generate 3 variant interpretations of the design after the initial generation,
so that the audience sees multiple creative possibilities from one sketch.

**Acceptance Criteria:**
1. GENERATE VARIANTS button appears after successful initial generation
2. Calls Stitch `generate_variants` with `creativeRange: REIMAGINE` and 3 variants
3. Variants are displayed in a horizontal gallery row below the main result
4. Each variant shows a screenshot/preview and can be selected for full preview
5. Selected variant can be deployed to its own Vercel URL
6. Variant generation uses same branding constraints as initial generation

#### Story 2.2: Stage-Ready Loading Experience

As a **presenter**,
I want polished loading animations during generation,
so that the waiting time itself is part of the show.

**Acceptance Criteria:**
1. Full-screen overlay with branded gradient background during generation
2. Animated step indicators: "ANALYZING SKETCH LAYOUT" → "APPLYING FUTURE FOUNDATION BRANDING" → "GENERATING WEBSITE CODE" → "DEPLOYING TO VERCEL" → "WEBSITE IS LIVE"
3. Each step transitions with smooth animation
4. Spinner or pulse animation maintains visual engagement
5. Total animation time adapts to actual pipeline progress (not fixed delays)

#### Story 2.3: Result Display with QR Code & Share

As a **presenter**,
I want the result screen to show the deployed URL prominently with a QR code,
so that the audience can instantly access the generated website on their phones.

**Acceptance Criteria:**
1. Deployed URL displayed in large, readable font (visible from back of auditorium)
2. QR code generated automatically from the deployed URL
3. QR code is large enough to scan from audience (minimum 200x200px on screen)
4. Copy URL button with visual confirmation
5. "Open in new tab" button for full-screen preview

---

## 7. Checklist Results Report

*To be completed after PRD review with @po validation.*

---

## 8. Next Steps

### 8.1 UX Expert Prompt

> @ux-design-expert — Review the Sketch 2 Reality PRD at `aiox-sketch2reality/docs/prd/prd.md`. Focus on the stage presentation experience: the split-panel layout, the loading animation flow, the result display with QR code. Optimize for maximum "UAU factor" on a 1920x1080 projection. The existing prototype screenshots are at `sketch2reality-final.png` and `sketch2reality-ui.png`.

### 8.2 Architect Prompt

> @architect — Review the Sketch 2 Reality PRD at `aiox-sketch2reality/docs/prd/prd.md`. Design the technical architecture for the end-to-end pipeline: Stitch MCP proxy → HTML extraction → Vercel deployment automation. Key constraint: everything runs locally on a laptop, must be reliable for live demos. Existing prototype code is in `src/server.js` and `src/public/index.html`.
