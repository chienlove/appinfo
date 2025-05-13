import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { id: appId, page = 1, limit = 1000 } = req.query;

    if (!appId || !/^\d+$/.test(appId)) {
        return res.status(400).json({
            message: "Invalid app ID",
            error: "App ID must be numeric",
            appId
        });
    }

    try {
        const result = await tryPrimaryApi(appId, page, limit);
        return res.status(200).json(result);
    } catch (primaryError) {
        console.log('Primary API failed:', primaryError.message);
        try {
            const result = await tryFallbackApi(appId, page, limit);
            return res.status(200).json(result);
        } catch (fallbackError) {
            console.error('Both APIs failed:', fallbackError);
            return createErrorResponse(fallbackError, appId, res);
        }
    }
}

async function tryPrimaryApi(appId, page, limit) {
    const apiUrl = `https://api.timbrd.com/apple/app-version/index.php?id=${appId}&page=${page}&limit=${limit}`;
    const MAX_CHUNKS = 3;

    let allData = [];
    let hasMore = true;
    let currentChunk = 1;

    while (hasMore && currentChunk <= MAX_CHUNKS) {
        const chunkUrl = `${apiUrl}&chunk=${currentChunk}`;
        const chunkData = await fetchWithRetry(chunkUrl);

        if (Array.isArray(chunkData) && chunkData.length > 0) {
            allData = allData.concat(chunkData);
            if (chunkData.length < limit) hasMore = false;
        } else {
            hasMore = false;
        }

        currentChunk++;
    }

    if (allData.length === 0) throw new Error('No data found in primary API');

    return formatSuccessResponse(allData, currentChunk - 1, hasMore);
}

async function tryFallbackApi(appId, page, limit) {
    const fallbackUrl = `https://storeios.net/api/getAppVersions?id=${appId}&page=${page}&limit=${limit}`;
    const data = await fetchWithRetry(fallbackUrl);

    if (!Array.isArray(data) || data.length === 0)
        throw new Error('No data found in fallback API');

    return formatSuccessResponse(data, 1, false);
}

async function fetchWithRetry(url, attempt = 1) {
    const MAX_RETRIES = 3;
    const TIMEOUT = 30000;

    try {
        const response = await fetch(url, {
            timeout: TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const text = await response.text();
        if (!text || text.trim() === '') throw new Error('Empty response');

        try {
            return JSON.parse(text);
        } catch (parseError) {
            if (text.includes('sodar')) throw new Error('SODAR_REDIRECT');
            throw parseError;
        }

    } catch (error) {
        if (attempt < MAX_RETRIES && !error.message.includes('SODAR_REDIRECT')) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return fetchWithRetry(url, attempt + 1);
        }
        throw error;
    }
}

function formatSuccessResponse(data, chunks, hasMore) {
    const uniqueData = Array.from(new Map(data.map(item => [item.external_identifier, item])).values());

    const sortedData = uniqueData.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return {
        data: sortedData,
        metadata: {
            total: sortedData.length,
            chunks,
            hasMore
        }
    };
}

function createErrorResponse(error, appId, res) {
    const statusCode = error.message.includes('404') ? 404 :
                       error.message.includes('SODAR_REDIRECT') ? 403 : 500;

    return res.status(statusCode).json({
        message: "Request failed",
        error: error.message,
        appId
    });
}