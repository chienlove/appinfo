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

    // Gọi API với timeout 15s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    try {
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
        const errorText = await response.text();
        console.error(`API responded with status ${response.status}: ${errorText}`);
        return res.status(response.status).json({ 
          success: false,
          error: "External API Error",
          message: `API responded with status ${response.status}` 
        });
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        return res.status(500).json({ 
          success: false,
          error: "Invalid Response Format",
          message: "Could not parse API response as JSON" 
        });
      }
      
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).json({
        success: true,
        data: data
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout');
        return res.status(504).json({ 
          success: false,
          error: "Gateway Timeout",
          message: "External API took too long to respond" 
        });
      }
      throw fetchError; // Let the outer catch block handle other fetch errors
    }
    
  } catch (error) {
    console.error('API Error:', error.message);
    return res.status(500).json({ 
      success: false,
      error: "Internal Server Error",
      message: error.message 
    });
  }
};