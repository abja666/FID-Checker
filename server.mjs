import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🏠 Root page — untuk preview & link Open in Warpcast
app.get("/", (req, res) => {
  const base = process.env.BASE_URL;
  res.send(`
    <html>
      <head>
        <meta property="og:title" content="FID Checker" />
        <meta property="og:description" content="Check your Farcaster FID instantly" />
        <meta property="og:image" content="${base}/public/icon-1024.png" />
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${base}/public/icon-1024.png" />
        <meta property="fc:frame:button:1" content="Check my FID" />
        <meta property="fc:frame:post_url" content="${base}/api/check" />
        <meta property="fc:miniapp" content="${base}/app/" />
        <style>
          body { background:#0b0b14; color:white; font-family:sans-serif; text-align:center; padding-top:60px }
          a.btn { color:#fff; background:#6b46c1; padding:12px 24px; border-radius:8px; text-decoration:none }
        </style>
      </head>
      <body>
        <h1>FID Checker is live 🚀</h1>
        <p>Cast this URL in Warpcast to see the Mini App.</p>
        <a class="btn" href="https://warpcast.com/~/compose?text=${encodeURIComponent(base)}">Open in Warpcast</a>
      </body>
    </html>
  `);
});

// 📱 Mini App — auto connect saat dibuka di Warpcast
app.get("/app", (req, res) => {
  const base = process.env.BASE_URL;
  res.send(`
    <html>
      <head>
        <title>FID Checker</title>
        <script src="https://cdn.jsdelivr.net/npm/@neynar/farcaster-js"></script>
        <style>
          body { background:#0b0b14; color:#fff; font-family:sans-serif; text-align:center; padding-top:80px }
          .card { background:#111; display:inline-block; padding:24px; border-radius:16px }
          button { background:#6b46c1; color:white; border:none; padding:12px 24px; border-radius:8px; cursor:pointer }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Connecting to Farcaster...</h2>
          <p>Harap tunggu sebentar, sedang memproses koneksi.</p>
        </div>

        <script type="module">
          import { NeynarFrameSDK } from "https://cdn.jsdelivr.net/npm/@neynar/farcaster-js@latest/+esm";
          const sdk = new NeynarFrameSDK({ apiKey: "${process.env.NEYNAR_API_KEY}" });

          try {
            const user = await sdk.actions.signIn(); // langsung minta izin connect
            document.body.innerHTML = \`
              <div class="card">
                <h2>Welcome!</h2>
                <p>Your FID: <b>\${user.fid}</b></p>
                <p>Username: @\${user.username}</p>
              </div>\`;
          } catch (err) {
            document.body.innerHTML = \`
              <div class="card">
                <h2>Connection failed</h2>
                <p>\${err.message}</p>
              </div>\`;
          }
        </script>
      </body>
    </html>
  `);
});

// ✅ API — validate frame klik dari Warpcast
app.post("/api/check", async (req, res) => {
  try {
    const { trustedData } = req.body;
    const result = await fetch("https://api.neynar.com/v2/farcaster/frame/validate", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api_key": process.env.NEYNAR_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message_bytes_in_hex: trustedData.messageBytes }),
    });
    const data = await result.json();

    const fid = data?.action?.interactor?.fid;
    const username = data?.action?.interactor?.username;
    const base = process.env.BASE_URL;

    return res.json({
      frame: {
        version: "vNext",
        image: `${base}/public/icon-1024.png`,
        post_url: `${base}/api/check`,
        buttons: [
          { label: `FID: ${fid}` },
          { label: `@${username}` },
        ],
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error validating frame");
  }
});

app.listen(3000, () => console.log("FID Checker running..."));
