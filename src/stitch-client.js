import crypto from 'crypto';

const STITCH_MCP_URL = 'https://stitch.googleapis.com/mcp';

export function createStitchClient(apiKey, projectId) {
  async function call(method, params) {
    const body = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    };

    const res = await fetch(STITCH_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });

    const text = await res.text();

    // Handle SSE responses
    if (text.startsWith('data:') || text.includes('\ndata:')) {
      const results = [];
      for (const line of text.split('\n')) {
        const payload = line.startsWith('data: ') ? line.slice(6) : line.startsWith('data:') ? line.slice(5) : null;
        if (payload) {
          try { results.push(JSON.parse(payload)); } catch {}
        }
      }
      const final = results.find(r => r.result || r.error);
      if (final?.error) throw new Error(JSON.stringify(final.error));
      return final?.result || results[results.length - 1]?.result;
    }

    const data = JSON.parse(text);
    if (data.error) throw new Error(JSON.stringify(data.error));
    return data.result;
  }

  function parseResult(result) {
    if (!result?.content) return result;
    for (const item of result.content) {
      if (item.type === 'text' && item.text) {
        try { return JSON.parse(item.text); } catch {}
      }
    }
    return result;
  }

  function extractScreens(data) {
    const screens = [];
    if (data?.outputComponents) {
      for (const comp of data.outputComponents) {
        if (comp.design?.screens) screens.push(...comp.design.screens);
      }
    }
    if (data?.screens) screens.push(...data.screens);
    if (data?.id && data?.htmlCode) screens.push(data);
    return screens;
  }

  async function healthCheck() {
    const result = await call('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'sketch2reality', version: '1.0.0' },
    });
    return result?.serverInfo?.name || 'connected';
  }

  async function generateScreen(prompt, deviceType = 'DESKTOP', modelId = 'GEMINI_3_FLASH') {
    const result = await call('tools/call', {
      name: 'generate_screen_from_text',
      arguments: { projectId, prompt, deviceType, modelId },
    });
    const parsed = parseResult(result);
    return extractScreens(parsed);
  }

  async function generateVariants(screenIds, prompt) {
    const result = await call('tools/call', {
      name: 'generate_variants',
      arguments: {
        projectId,
        selectedScreenIds: screenIds,
        prompt: prompt || 'Reimagine with completely different layouts. Keep Future Foundation branding — dark mode, blue accent, Space Grotesk uppercase.',
        variantOptions: {
          variantCount: 3,
          creativeRange: 'REIMAGINE',
          aspects: ['LAYOUT', 'COLOR_SCHEME', 'IMAGES'],
        },
        deviceType: 'DESKTOP',
        modelId: 'GEMINI_3_FLASH',
      },
    });
    const parsed = parseResult(result);
    return extractScreens(parsed);
  }

  async function listScreens() {
    const result = await call('tools/call', {
      name: 'list_screens',
      arguments: { projectId },
    });
    return parseResult(result);
  }

  return { call, parseResult, extractScreens, healthCheck, generateScreen, generateVariants, listScreens };
}
