const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// CORS for your frontend
app.use(cors({
  origin: [
    'https://ppl-ai-code-interpreter-files.s3.amazonaws.com',
    'http://localhost:3000',
    'http://localhost:5173'
  ]
}));

app.use(express.json());

// Health check (should work immediately)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Online',
    service: 'TRYMEE Buyhatke Scraper',
    timestamp: new Date().toISOString(),
    note: 'Server running without Puppeteer for now'
  });
});

// Simple test endpoint
app.post('/api/scrape-buyhatke', async (req, res) => {
  const { productUrl } = req.body;
  
  // For now, return mock data to test if server works
  res.json({
    success: true,
    productName: 'Test Product',
    originalUrl: productUrl,
    offers: [
      {
        platform: 'Amazon',
        price: '₹1,299',
        rating: '4.2',
        reviews: '1000+',
        availability: 'In Stock',
        buyUrl: productUrl
      }
    ],
    note: 'Mock data - Puppeteer will be added once server works'
  });
});

// Start server immediately (no browser initialization)
app.listen(PORT, () => {
  console.log(`🚀 TRYMEE Backend running on port ${PORT}`);
  console.log(`✅ Server started successfully`);
});
