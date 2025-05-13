const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    const appId = req.query.id;
    
    if (!appId || !/^\d+$/.test(appId)) {
      return res.status(400).json({
        error: "Invalid App ID",
        message: "App ID must be numeric"
      });
    }

    const response = await fetch(`https://itunes.apple.com/lookup?id=${appId}`);
    const data = await response.json();
    
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(data);
    
  } catch (error) {
    console.error('iTunes API Error:', error);
    res.status(500).json({
      error: "iTunes API Error",
      message: error.message
    });
  }
};