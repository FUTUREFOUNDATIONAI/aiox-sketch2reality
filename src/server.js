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
import { analyzeSketch, buildPromptFromAnalysis } from './sketch-analyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Config from env — NEVER hardcode API keys
const STITCH_API_KEY = process.env.STITCH_API_KEY;
const PROJECT_ID = process.env.STITCH_PROJECT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3777;

if (!STITCH_API_KEY || !PROJECT_ID) {
  console.error('Missing required environment variables: STITCH_API_KEY, STITCH_PROJECT_ID');
  console.error('Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

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
    console.error('[HEALTH ERROR]', err.message);
    res.json({ status: 'error', error: 'Health check failed', vercel: vercel.configured ? 'ok' : 'not_configured' });
  }
});

// --- Full Pipeline: Analyze Sketch → Generate → Extract HTML → Deploy ---
app.post('/api/generate', upload.single('sketch'), async (req, res) => {
  try {
    const userPrompt = typeof req.body.prompt === 'string' ? req.body.prompt.slice(0, 2000) : '';
    const allowedDevices = ['DESKTOP', 'MOBILE', 'TABLET'];
    const allowedModels = ['GEMINI_3_FLASH', 'GEMINI_3_PRO'];
    const deviceType = allowedDevices.includes(req.body.deviceType) ? req.body.deviceType : 'DESKTOP';
    const modelId = allowedModels.includes(req.body.modelId) ? req.body.modelId : 'GEMINI_3_FLASH';

    // Stage 0: Analyze sketch image with Gemini Vision (if uploaded)
    let sketchContext = '';
    if (req.file?.buffer) {
      try {
        console.log(`[ANALYZE] Analyzing sketch image (${req.file.size} bytes)...`);
        const analysis = await analyzeSketch(req.file.buffer, GEMINI_API_KEY);
        sketchContext = buildPromptFromAnalysis(analysis);
        console.log(`[ANALYZE] Extracted: ${analysis.texts?.length || 0} texts, ${analysis.sections?.length || 0} sections`);
      } catch (err) {
        console.error(`[ANALYZE ERROR] ${err.message} — falling back to text-only prompt`);
      }
    }

    // Build final prompt: branding + sketch analysis + user prompt
    let prompt = BRANDING_PROMPT;
    if (sketchContext) {
      prompt += `\n\nSKETCH ANALYSIS (preserve ALL text and layout from the sketch):\n${sketchContext}`;
    }
    if (userPrompt) {
      prompt += `\n\nADDITIONAL: ${userPrompt}`;
    }

    console.log(`[GENERATE] device=${deviceType} model=${modelId} hasSketch=${!!sketchContext}`);

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
      html: extraction?.html || null,
      deployedUrl: deployment.deployed ? deployment.url : null,
      deployAlias: deployment.alias || null,
    });
  } catch (err) {
    console.error('[GENERATE ERROR]', err.message);
    res.status(500).json({ error: 'Generation failed', stage: 'stitch_generation', partial: null });
  }
});

// --- Variant Generation ---
app.post('/api/generate-variants', async (req, res) => {
  try {
    const { screenIds, prompt } = req.body;
    if (!Array.isArray(screenIds) || screenIds.length === 0 || screenIds.length > 10) {
      return res.status(400).json({ error: 'screenIds must be an array of 1-10 IDs' });
    }
    if (!screenIds.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id))) {
      return res.status(400).json({ error: 'Invalid screen ID format' });
    }
    console.log(`[VARIANTS] screens=${screenIds.join(',')}`);

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
    res.status(500).json({ error: 'Variant generation failed' });
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
    res.status(500).json({ error: 'Deployment failed' });
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
    res.status(500).json({ error: 'Failed to list screens' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Sketch 2 Reality running at http://localhost:${PORT}`);
  console.log(`  Stitch Project: ${PROJECT_ID}`);
  console.log(`  Vercel: ${vercel.configured ? 'configured' : 'not configured (local preview only)'}\n`);
});
