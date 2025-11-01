import 'dotenv/config';
import express from 'express';
import path from 'path';
import fetch from 'node-fetch';
import serverless from 'serverless-http';

const app = express();
app.use(express.json({ limit: '1mb' }));

// serve assets
app.use('/public', express.static(path.join(process.cwd(), 'public')));
app.use('/app', express.static(path.join(process.cwd(), 'public/app')));

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';

// ── OPTIONAL: kalau pakai Hosted Manifest, aktifkan redirect ini
// app.get('/.well-known/farcaster.json', (req, res) => {
//   res.redirect(307, 'https://api.farcaster.xyz/miniapps/hosted-manifest/<YOUR_ID>');
// });

// Home: embed Mini App + tombol Frame
app.get('/', (req, res) => {
  const html = `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta property="og:title" content="FID Checker"/>
<meta property="og:image" content="${BASE_URL}/public/og.png"/>

<meta name="fc:miniapp" content='{
  "version":"1",
  "imageUrl":"${BASE_URL}/public/og.png",
  "button":{
    "title":"Open FID Checker",
    "action":{
      "type":"launch_miniapp",
      "url":"${BASE_URL}/app/",
      "name":"FID Checker",
      "splashImageUrl":"${BASE_URL}/public/icon-1024.png",
      "splashBackgroundColor":"#0b0b14"
    }
  }
}'/>

<meta property="fc:frame" content="vNext"/>
<meta property="fc:frame:image" content="${BASE_URL}/public/og.png"/>
<meta property="fc:frame:button:1" content="Check my FID"/>
<meta property="fc:frame:post_url" content="${BASE_URL}/api/check"/>

<title>FID Checker</title></head><body>FID Checker</body></html>`;
  res.set('content-type', 'text/html').send(html);
});

// Frame action → validasi ke Neynar → render kartu FID/handle
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
        const j = await r.json();
        valid = !!j?.valid;
        fid = j?.action?.user?.fid ?? fid;
        handle = j?.action?.user?.username ?? null;
      }
    }

    if (!valid || !fid) {
      return res.status(200).json({
        frame: {
          version: 'vNext',
          image: `${BASE_URL}/public/og.png`,
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
    return res.status(200).json({
      frame: {
        version: 'vNext',
        image: `${BASE_URL}/public/og.png`,
        buttons: [{ label: 'Error, Retry' }],
        postUrl: `${BASE_URL}/api/check`
      }
    });
  }
});

// Dynamic SVG (ditampilkan di feed)
app.get('/api/card', (req, res) => {
  const fid = req.query.fid || '0';
  const handle = req.query.handle || '';
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <rect width="1200" height="800" fill="#0b0b14"/>
  <text x="600" y="220" font-size="64" fill="#c7d2fe" text-anchor="middle" font-family="Verdana">Farcaster FID Checker</text>
  <text x="600" y="420" font-size="96" fill="#ffffff" text-anchor="middle" font-family="Verdana">FID #${fid}</text>
  <text x="600" y="560" font-size="56" fill="#a5b4fc" text-anchor="middle" font-family="Verdana">${handle ? '@'+handle : ''}</text>
</svg>`;
  res.set('content-type', 'image/svg+xml').send(svg);
});

// Export untuk Vercel (serverless). Untuk lokal, pakai npm run dev.
export default serverless(app);
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Running locally on ${BASE_URL}`));
}
