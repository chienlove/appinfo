export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.body['cf-turnstile-response'];
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const secret = process.env.TURNSTILE_SECRET;

  if (!token) {
    return res.status(400).json({ error: 'Missing Turnstile token' });
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
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
