// api/getAppVersions.js
const fetch = require('node-fetch');

// Config
const PRIMARY_API_URL = 'https://api.timbrd.com/apple/app-version/index.php';
const FALLBACK_API_URL = 'https://storeios.net/api/getAppVersions';
const TIMEOUT = 8000; // 8 seconds
const MAX_RETRIES = 2;

module.exports = async (req, res) => {
  // CORS headers (cho phép gọi từ mọi domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Validate App ID
  const appId = req.query.id;
  if (!appId || !/^\d+$/.test(appId)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_APP_ID",
      message: "App ID must be a numeric value",
      requestedId: appId
    });
  }

  try {
    // Thử primary API trước
    let data = await fetchWithRetry(
      `${PRIMARY_API_URL}?id=${appId}`,
      TIMEOUT,
      MAX_RETRIES
    );

    // Nếu primary API fail, thử fallback
    if (!data || data.error) {
      data = await fetchWithRetry(
        `${FALLBACK_API_URL}?id=${appId}`,
        TIMEOUT,
        MAX_RETRIES
      );
    }

    // Nếu cả hai API đều fail
    if (!data) {
      throw new Error('All API requests failed');
    }

    // Format response chuẩn
    const response = {
      success: true,
      appId: appId,
      data: processData(data), // Xử lý data trước khi trả về
      lastUpdated: new Date().toISOString()
    };

    return res.status(200).json(response);

  } catch (error) {
    // Log lỗi ra console (sẽ hiển thị trong Vercel Logs)
    console.error('API Error:', error.message);

    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "Unable to fetch app versions",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      appId: appId
    });
  }
};

// Hàm fetch với retry và timeout
async function fetchWithRetry(url, timeout, retries) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying ${url}... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, timeout, retries - 1);
    }
    throw error;
  }
}

// Xử lý data từ API
function processData(data) {
  if (!data) return null;

  // Chuẩn hóa dữ liệu (tùy API response)
  return Array.isArray(data) 
    ? data.map(item => ({
        version: item.bundle_version || 'N/A',
        releaseDate: item.created_at || null,
        identifier: item.external_identifier || null
      }))
    : data;
}