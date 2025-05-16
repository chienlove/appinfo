// api/verify-turnstile.js
const handler = async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.body['cf-turnstile-response'] || req.body.token;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const secret = process.env.TURNSTILE_SECRET;

  if (!token) {
    return res.status(400).json({ error: 'Missing Turnstile token' });
  }

  if (!secret) {
    console.error('TURNSTILE_SECRET environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    });

    const data = await result.json();

    if (!data.success) {
      return res.status(403).json({ error: 'Turnstile verification failed', details: data });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

module.exports = handler;