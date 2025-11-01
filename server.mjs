// server.mjs
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fetch from 'node-fetch';

const app = express();
app.use(express.json({ limit: '1mb' }));

// serve assets
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// NOTE: Vercel serves functions; do NOT call app.listen()
// We just export the Express app at the bottom.

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';

app.get('/', (req, res) => {
  const html = `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>FID Checker</title>

<!-- OpenGraph -->
<meta property="og:title" content="FID Checker"/>
<meta property="og:image" content="${BASE_URL}/og.png"/>

<!-- Mini App embed -->
<meta name="fc:miniapp" content='{
  "version":"1",
  "imageUrl":"${BASE_URL}/og.png",
  "button":{
    "title":"Open FID Checker",
    "action":{
      "type":"launch_miniapp",
      "url":"${BASE_URL}/",
      "name":"FID Checker",
      "splashImageUrl":"${BASE_URL}/icon-1024.png",
      "splashBackgroundColor":"#0b0b14"
    }
  }
}'/>

<!-- Frame (vNext) -->
<meta property="fc:frame" content="vNext"/>
<meta property="fc:frame:image" content="${BASE_URL}/og.png"/>
<meta property="fc:frame:button:1" content="Check my FID"/>
<meta property="fc:frame:post_url" content="${BASE_URL}/api/check"/>

<style>
  :root{color-scheme:dark light}
  body{margin:0;display:grid;place-items:center;min-height:100svh;
       background:#0b0b14;color:#e5e7eb;font:16px/1.6 system-ui}
  .card{padding:22px 24px;border:1px solid #232535;border-radius:16px;background:#111827;max-width:520px}
  h1{margin:0 0 6px;font-size:26px}
  p{margin:0 0 6px;color:#a7b0c0}
  a{color:#a78bfa;text-decoration:none}
  a:hover{text-decoration:underline}
</style>
</head><body>
  <div class="card">
    <h1>FID Checker is live 🚀</h1>
    <p>Cast this URL in Warpcast to see the Frame/Mini App buttons.</p>
    <p style="margin-top:10px">
      <a href="${BASE_URL}/.well-known/farcaster.json">manifest</a> ·
      <a href="${BASE_URL}/api/card?fid=123&handle=abja666">sample card</a>
    </p>
  </div>
</body></html>`;
  res.set('content-type', 'text/html').send(html);
});

// Frame action → validate to Neynar → return frame res
app.post('/api/check', async (req, res) => {
  try {
    const payload = req.body;
    const msgHex = payload?.trustedData?.messageBytes;

    let fid = payload?.untrustedData?.fid || null;
    let handle = null;
    let valid = true;

    if (NEYNAR_API_KEY) {
      if (!msgHex) valid = false;
      else {
        const r = await fetch('https://api.neynar.com/v2/farcaster/frame/validate', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'api_key': NEYNAR_API_KEY },
          body: JSON.stringify({ message_bytes_in_hex: msgHex })
        });
        if (!r.ok) {
          valid = false;
        } else {
          const j = await r.json();
          valid = !!j?.valid;
          fid = j?.action?.user?.fid ?? fid;
          handle = j?.action?.user?.username ?? null;
        }
      }
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
    console.error('check error', e);
    return res.status(200).json({
      frame: {
        version: 'vNext',
        image: `${BASE_URL}/og.png`,
        buttons: [{ label: 'Error, Retry' }],
        postUrl: `${BASE_URL}/api/check`
      }
    });
  }
});

// Dynamic SVG card (rendered in feed)
app.get('/api/card', (req, res) => {
  const fid = req.query.fid || '0';
  const handle = req.query.handle || '';
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b0b14"/>
      <stop offset="1" stop-color="#1a1d2b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <text x="600" y="210" font-size="64" fill="#c7d2fe" text-anchor="middle" font-family="Verdana">Farcaster FID Checker</text>
  <text x="600" y="420" font-size="96" fill="#ffffff" text-anchor="middle" font-family="Verdana">FID #${fid}</text>
  <text x="600" y="560" font-size="56" fill="#a5b4fc" text-anchor="middle" font-family="Verdana">${handle ? '@'+handle : ''}</text>
</svg>`;
  res.set('content-type', 'image/svg+xml').send(svg);
});

// Export Express app for Vercel runtime (no app.listen here!)
export default app;

// For local dev only (node server.mjs)
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Local dev on ${BASE_URL}`));
}
