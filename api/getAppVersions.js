const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    const appId = req.query.id;
    
    // Validate App ID
    if (!appId || !/^\d+$/.test(appId)) {
      return res.status(400).json({ 
        error: "Invalid App ID",
        message: "App ID must be numeric" 
      });
    }

    // Gọi API với timeout 8s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(
      `https://api.timbrd.com/apple/app-version/index.php?id=${appId}`,
      { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'AppInfo/1.0'
        }
      }
    );
    
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json({
      success: true,
      data: data
    });
    
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: "Internal Server Error",
      message: error.message 
    });
  }
};