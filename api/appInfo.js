module.exports = async (req, res) => {
  try {
    const appId = req.query.id;
    
    // Kiểm tra định dạng App ID
    if (!appId || !/^\d+$/.test(appId)) {
      return res.status(400).json({
        error: "Invalid App ID",
        message: "App ID must be numeric"
      });
    }

    // Gọi API iTunes
    const response = await fetch(`https://itunes.apple.com/lookup?id=${appId}`);
    
    // Kiểm tra nếu lỗi HTTP
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`iTunes API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({
        error: "iTunes API Error",
        message: `HTTP ${response.status}`
      });
    }

    const data = await response.json();

    // Caching 1 tiếng
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