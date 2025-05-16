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

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const token = body.token || body['cf-turnstile-response'];
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
        const secret = process.env.TURNSTILE_SECRET;

        if (!token) {
            return res.status(400).json({ 
                error: 'Missing Turnstile token',
                details: 'Token not provided in request body' 
            });
        }

        if (!secret) {
            console.error('TURNSTILE_SECRET is not set');
            return res.status(500).json({ 
                error: 'Server configuration error',
                details: 'Turnstile secret key not configured' 
            });
        }

        const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        const result = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: secret,
                response: token,
                remoteip: ip,
            }),
        });

        const data = await result.json();

        if (!data.success) {
            console.error('Turnstile verification failed:', data);
            return res.status(403).json({ 
                success: false,
                error: 'Turnstile verification failed',
                details: data['error-codes'] 
            });
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Turnstile verification error:', err);
        return res.status(500).json({ 
            success: false,
            error: 'Internal server error',
            details: err.message 
        });
    }
};

module.exports = handler;