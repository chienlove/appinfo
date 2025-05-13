import fetch from 'node-fetch';

export default async function handler(req, res) {
    const appId = req.query.id;

    if (!appId || !/^\d+$/.test(appId)) {
        return res.status(400).json({
            message: "Invalid app ID",
            error: "App ID must be numeric",
            appId
        });
    }

    const apiUrl = `https://itunes.apple.com/lookup?id=${appId}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            message: "Lỗi khi gọi iTunes API",
            error: error.message
        });
    }
}