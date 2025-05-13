module.exports = async (req, res) => {
  try {
    const { id, term } = req.query;
    
    // Nếu là tìm kiếm bằng tên
    if (term) {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=10`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`iTunes Search Error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({
          error: "iTunes Search Error",
          message: `HTTP ${response.status}`
        });
      }

      const data = await response.json();
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).json(data);
    }
    
    // Nếu là tìm kiếm bằng App ID
    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "Invalid App ID",
        message: "App ID must be numeric"
      });
    }

    const response = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`iTunes API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({
        error: "iTunes API Error",
        message: `HTTP ${response.status}`
      });
    }

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