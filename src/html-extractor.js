import crypto from 'crypto';

const store = new Map();

export async function extractHtml(screen) {
  const url = screen?.htmlCode?.downloadUrl;
  if (!url) return null;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTML download failed: ${res.status}`);

  let html = await res.text();

  // Ensure valid HTML structure
  if (!html.includes('<html')) {
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Future Foundation</title></head><body>${html}</body></html>`;
  }

  // Inject Google Fonts if not present
  if (!html.includes('fonts.googleapis.com')) {
    html = html.replace('</head>',
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@300;400;500;600&display=swap" rel="stylesheet"></head>'
    );
  }

  const id = `gen_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  store.set(id, html);

  return { id, html, screenshotUrl: screen?.screenshot?.downloadUrl };
}

export function getStoredHtml(id) {
  return store.get(id) || null;
}

export function clearStore() {
  store.clear();
}
