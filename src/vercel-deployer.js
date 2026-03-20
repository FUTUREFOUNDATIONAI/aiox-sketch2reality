import crypto from 'crypto';

const VERCEL_API = 'https://api.vercel.com';

export function createVercelDeployer({ token, projectId, teamId, alias }) {
  const configured = !!token;

  function headers() {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  function teamQuery() {
    return teamId ? `?teamId=${teamId}` : '';
  }

  async function deploy(html, label = '') {
    if (!configured) return { deployed: false, reason: 'no_token' };

    const content = Buffer.from(html, 'utf-8');
    const sha = crypto.createHash('sha1').update(content).digest('hex');
    const size = content.length;

    // Step 1: Upload file
    const uploadRes = await fetch(`${VERCEL_API}/v2/files${teamQuery()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Length': String(size),
        'x-vercel-digest': sha,
      },
      body: content,
      signal: AbortSignal.timeout(15_000),
    });

    if (!uploadRes.ok && uploadRes.status !== 409) {
      throw new Error(`Vercel file upload failed: ${uploadRes.status}`);
    }

    // Step 2: Create deployment
    const deployBody = {
      name: 'ff-sketch2reality',
      files: [{ file: 'index.html', sha, size }],
      projectSettings: {
        framework: null,
        buildCommand: '',
        outputDirectory: '.',
      },
    };

    if (projectId) deployBody.project = projectId;

    const deployRes = await fetch(`${VERCEL_API}/v13/deployments${teamQuery()}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(deployBody),
      signal: AbortSignal.timeout(15_000),
    });

    if (!deployRes.ok) {
      const err = await deployRes.text();
      throw new Error(`Vercel deploy failed: ${deployRes.status} — ${err}`);
    }

    const deployment = await deployRes.json();
    let url = `https://${deployment.url}`;

    // Step 3: Poll until ready (max 60s)
    const deployId = deployment.id;
    const deadline = Date.now() + 60_000;

    while (Date.now() < deadline) {
      const statusRes = await fetch(`${VERCEL_API}/v13/deployments/${deployId}${teamQuery()}`, {
        headers: headers(),
      });
      const status = await statusRes.json();

      if (status.readyState === 'READY') {
        url = `https://${status.url}`;
        break;
      }
      if (status.readyState === 'ERROR') {
        throw new Error(`Vercel deploy error: ${status.errorMessage || 'unknown'}`);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    // Step 4: Set alias if configured
    if (alias) {
      try {
        await fetch(`${VERCEL_API}/v2/deployments/${deployId}/aliases${teamQuery()}`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ alias }),
        });
      } catch {}
    }

    return { deployed: true, url, deployId, alias: alias || null };
  }

  return { deploy, configured };
}
