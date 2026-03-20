import { readFileSync } from 'fs';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env manually (zero deps)
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}
import { createStitchClient } from './stitch-client.js';
import { extractHtml, getStoredHtml } from './html-extractor.js';
import { createVercelDeployer } from './vercel-deployer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Config from env
const STITCH_API_KEY = process.env.STITCH_API_KEY || 'REDACTED_STITCH_KEY_2';
const PROJECT_ID = process.env.STITCH_PROJECT_ID || '6851128296893269757';
const PORT = process.env.PORT || 3777;

const stitch = createStitchClient(STITCH_API_KEY, PROJECT_ID);
const vercel = createVercelDeployer({
  token: process.env.VERCEL_TOKEN,
  projectId: process.env.VERCEL_PROJECT_ID,
  teamId: process.env.VERCEL_TEAM_ID,
  alias: process.env.VERCEL_ALIAS,
});

const BRANDING_PROMPT = `Transform this hand-drawn sketch into a premium, production-quality website for FUTURE FOUNDATION — a strategic consulting company.

BRANDING:
- Company: FUTURE FOUNDATION
- Primary: #006EEB | Surface: #0c1322 | Container: #141b2b | Text: #dce2f7
- Headlines: Space Grotesk, ALL UPPERCASE, tracking +2%
- Body: Manrope
- No borders — tonal surface layering only
- Border radius: 4px max
- Glassmorphic nav with backdrop-blur
- CTA gradient: #aec6ff → #006eeb at 135deg
- Massive negative space, editorial quality, futuristic
- Style: McKinsey meets Silicon Valley — jaw-dropping

INTERPRET THE SKETCH LAYOUT FAITHFULLY. Elevate every element to world-class design. Add real placeholder content for a strategic consulting firm.`;

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static(join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

// --- Health Check ---
app.get('/api/health', async (req, res) => {
  try {
    const server = await stitch.healthCheck();
    res.json({
      status: 'ok',
      projectId: PROJECT_ID,
      server,
      vercel: vercel.configured ? 'ok' : 'not_configured',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.json({ status: 'error', error: err.message, vercel: vercel.configured ? 'ok' : 'not_configured' });
  }
});

// --- Full Pipeline: Generate → Extract HTML → Deploy ---
app.post('/api/generate', upload.single('sketch'), async (req, res) => {
  try {
    const userPrompt = req.body.prompt || '';
    const prompt = userPrompt ? `${BRANDING_PROMPT}\n\nADDITIONAL: ${userPrompt}` : BRANDING_PROMPT;
    const deviceType = req.body.deviceType || 'DESKTOP';
    const modelId = req.body.modelId || 'GEMINI_3_FLASH';

    console.log(`[GENERATE] device=${deviceType} model=${modelId}`);

    // Stage 1: Generate via Stitch
    const screens = await stitch.generateScreen(prompt, deviceType, modelId);

    if (!screens.length) {
      return res.json({ error: 'No screens generated', stage: 'stitch_generation', partial: null });
    }

    const screen = screens[0];
    console.log(`[GENERATE] screen=${screen.id} hasHtml=${!!screen.htmlCode?.downloadUrl}`);

    // Stage 2: Extract HTML
    let extraction = null;
    if (screen.htmlCode?.downloadUrl) {
      try {
        extraction = await extractHtml(screen);
        console.log(`[GENERATE] html extracted id=${extraction.id} size=${extraction.html.length}`);
      } catch (err) {
        console.error(`[HTML EXTRACT ERROR] ${err.message}`);
      }
    }

    // Stage 3: Deploy to Vercel (non-blocking if fails)
    let deployment = { deployed: false, reason: 'no_html' };
    if (extraction) {
      try {
        deployment = await vercel.deploy(extraction.html, `sketch-${Date.now()}`);
        if (deployment.deployed) {
          console.log(`[DEPLOY] url=${deployment.url}`);
        }
      } catch (err) {
        console.error(`[DEPLOY ERROR] ${err.message}`);
        deployment = { deployed: false, reason: err.message };
      }
    }

    res.json({
      screenId: screen.id,
      screenshot: screen.screenshot || null,
      htmlCode: screen.htmlCode || null,
      generationId: extraction?.id || null,
      localPreviewUrl: extraction ? `/api/result/${extraction.id}` : null,
      deployedUrl: deployment.deployed ? deployment.url : null,
      deployAlias: deployment.alias || null,
    });
  } catch (err) {
    console.error('[GENERATE ERROR]', err.message);
    res.status(500).json({ error: err.message, stage: 'stitch_generation', partial: null });
  }
});

// --- Variant Generation ---
app.post('/api/generate-variants', async (req, res) => {
  try {
    const { screenIds, prompt } = req.body;
    console.log(`[VARIANTS] screens=${screenIds?.join(',')}`);

    const screens = await stitch.generateVariants(screenIds, prompt);

    // Extract HTML for each variant
    const variants = [];
    for (const screen of screens) {
      let extraction = null;
      if (screen.htmlCode?.downloadUrl) {
        try { extraction = await extractHtml(screen); } catch {}
      }
      variants.push({
        screenId: screen.id,
        screenshot: screen.screenshot || null,
        htmlCode: screen.htmlCode || null,
        generationId: extraction?.id || null,
        localPreviewUrl: extraction ? `/api/result/${extraction.id}` : null,
      });
    }

    res.json({ variants });
  } catch (err) {
    console.error('[VARIANTS ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Deploy a specific variant ---
app.post('/api/deploy-variant', async (req, res) => {
  try {
    const { generationId, htmlUrl } = req.body;

    let html = generationId ? getStoredHtml(generationId) : null;

    // If not in store, try fetching from URL
    if (!html && htmlUrl) {
      const fetchRes = await fetch(htmlUrl, { signal: AbortSignal.timeout(15_000) });
      html = await fetchRes.text();
    }

    if (!html) {
      return res.status(400).json({ error: 'No HTML available for deployment' });
    }

    const deployment = await vercel.deploy(html, `variant-${Date.now()}`);
    res.json({ deployedUrl: deployment.deployed ? deployment.url : null });
  } catch (err) {
    console.error('[DEPLOY VARIANT ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Serve stored HTML (local preview) ---
app.get('/api/result/:id', (req, res) => {
  const html = getStoredHtml(req.params.id);
  if (!html) return res.status(404).json({ error: 'Generation not found' });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// --- List screens (polling fallback) ---
app.get('/api/screens', async (req, res) => {
  try {
    const result = await stitch.listScreens();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Sketch 2 Reality running at http://localhost:${PORT}`);
  console.log(`  Stitch Project: ${PROJECT_ID}`);
  console.log(`  Vercel: ${vercel.configured ? 'configured' : 'not configured (local preview only)'}\n`);
});
