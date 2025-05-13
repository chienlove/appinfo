const fetch = require('node-fetch');

module.exports = async (req, res) => {
  console.log('Request received'); // Log để debug
  
  try {
    // Validate App ID
    const appId = req.query.id;
    if (!appId || !/^\d+$/.test(appId)) {
      console.log('Invalid App ID:', appId);
      return res.status(400).json({ error: "Invalid App ID" });
    }

    // Gọi API với timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const response = await fetch(
      `https://api.timbrd.com/apple/app-version/index.php?id=${appId}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    
    console.log('Successfully fetched data'); // Log thành công
    res.setHeader('Cache-Control', 's-maxage=60');
    res.json(data);
    
  } catch (error) {
    console.error('Error:', error.message); // Log lỗi ra Vercel Logs
    res.status(500).json({ 
      error: "Internal Server Error",
      message: error.message 
    });
  }
};