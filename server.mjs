import 'dotenv/config';
import express from 'express';
import path from 'path';
import fetch from 'node-fetch';

const app = express();
app.use(express.json({ limit: '1mb' }));

// static
const PUB = path.join(process.cwd(), 'public');
app.use('/public', express.static(PUB));
app.use('/app', express.static(path.join(PUB, 'app')));
app.get('/og.png', (_, res) => res.sendFile(path.join(PUB, 'og.png')));
app.get('/icon-1024.png', (_, res) => res.sendFile(path.join(PUB, 'icon-1024.png')));

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';

// ── Root: preview + tombol open miniapp (/app/?autoconnect=1)
app.get('/', (req, res) => {
  res.set('content-type', 'text/html').send(`<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>FID Checker</title>
<meta property="og:title" content="FID Checker"/><meta property="og:image" content="${BASE_URL}/og.png"/>

<meta name="fc:miniapp" content='{
  "version":"1",
  "imageUrl":"${BASE_URL}/og.png",
  "button":{
    "title":"Open FID Checker",
    "action":{
      "type":"launch_miniapp",
      "url":"${BASE_URL}/app/?autoconnect=1",
      "name":"FID Checker",
      "splashImageUrl":"${BASE_URL}/icon-1024.png",
      "splashBackgroundColor":"#0b0b14"
    }
  }
}'/>

<meta property="fc:frame" content="vNext"/>
<meta property="fc:frame:image" content="${BASE_URL}/og.png"/>
<meta property="fc:frame:button:1" content="Check my FID"/>
<meta property="fc:frame:post_url" content="${BASE_URL}/api/check"/>

<style>
:root{color-scheme:dark light}
body{margin:0;min-height:100svh;display:grid;place-items:center;background:#0b0b14;color:#e5e7eb;font:16px/1.6 system-ui}
.card{background:#111827;border:1px solid #232535;border-radius:16px;padding:22px 24px;max-width:560px}
a{color:#a78bfa;text-decoration:none}a:hover{text-decoration:underline}
</style></head><body>
<div class="card">
  <h1>FID Checker is live 🚀</h1>
  <p>Cast this link in Warpcast to see Frame/Mini App buttons.</p>
  <p><a href="${BASE_URL}/app/?autoconnect=1">open mini app</a> ·
     <a href="${BASE_URL}/.well-known/farcaster.json">manifest</a> ·
     <a href="${BASE_URL}/api/card?fid=123&handle=abja666">sample card</a></p>
</div>
</body></html>`);
});

// Frame action → validate via Neynar → return image+buttons
app.post('/api/check', async (req, res) => {
  try {
    const msgHex = req.body?.trustedData?.messageBytes;
    let fid = req.body?.untrustedData?.fid ?? null;
    let handle = null;
    let valid = true;

    if (NEYNAR_API_KEY && msgHex) {
      const r = await fetch('https://api.neynar.com/v2/farcaster/frame/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'api_key': NEYNAR_API_KEY },
        body: JSON.stringify({ message_bytes_in_hex: msgHex })
      });
      const j = await r.json();
      valid = !!j?.valid;
      fid = j?.action?.user?.fid ?? fid;
      handle = j?.action?.user?.username ?? null;
    }

    if (!valid || !fid) {
      return res.status(200).json({
        frame: {
          version: 'vNext',
          image: `${BASE_URL}/og.png`,
          buttons: [{ label: NEYNAR_API_KEY ? 'Invalid, Retry' : 'Dev mode: no API key' }],
          postUrl: `${BASE_URL}/api/check`
        }
      });
    }

    const img = `${BASE_URL}/api/card?fid=${encodeURIComponent(fid)}&handle=${encodeURIComponent(handle || '')}`;
    return res.status(200).json({
      frame: {
        version: 'vNext',
        image: img,
        buttons: [
          { label: `FID: ${fid}` },
          { label: handle ? `@${handle}` : 'No handle' }
        ],
        postUrl: `${BASE_URL}/api/check`
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(200).json({
      frame: { version: 'vNext', image: `${BASE_URL}/og.png`, buttons: [{ label: 'Error, Retry' }], postUrl: `${BASE_URL}/api/check` }
    });
  }
});

// Dynamic SVG for the frame
app.get('/api/card', (req, res) => {
  const fid = req.query.fid || '0';
  const handle = req.query.handle || '';
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b0b14"/><stop offset="1" stop-color="#1a1d2b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="600" y="190" font-size="56" fill="#c7d2fe" text-anchor="middle" font-family="Verdana">Farcaster FID Checker</text>
  <text x="600" y="360" font-size="96" fill="#ffffff" text-anchor="middle" font-family="Verdana">FID #${fid}</text>
  <text x="600" y="470" font-size="48" fill="#a5b4fc" text-anchor="middle" font-family="Verdana">${handle ? '@'+handle : ''}</text>
</svg>`;
  res.set('content-type', 'image/svg+xml').send(svg);
});

// Export for Vercel; local dev fallback
export default app;
if (!process.env.VERCEL) app.listen(PORT, () => console.log(`Local dev → ${BASE_URL}`));
