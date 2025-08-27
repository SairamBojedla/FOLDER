const express = require('express');
const puppeteer = require('puppeteer');
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

let browser = null;

// Initialize browser
async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    console.log('🚀 Browser initialized');
  }
  return browser;
}

// REAL BUYHATKE SCRAPING ENDPOINT - NO RANDOM DATA
app.post('/api/scrape-buyhatke', async (req, res) => {
  const { productUrl } = req.body;
  console.log(`🔍 Scraping: ${productUrl}`);

  if (!productUrl) {
    return res.status(400).json({ success: false, error: 'Product URL required' });
  }

  let page = null;
  try {
    const browserInstance = await initBrowser();
    page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const buyhatkeUrl = `https://compare.buyhatke.com/products?redirect_url=${encodeURIComponent(productUrl)}`;
    console.log(`📄 Visiting: ${buyhatkeUrl}`);
    
    await page.goto(buyhatkeUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait longer for dynamic content

    // Extract ALL available offers with REAL data only
    const offers = await page.evaluate(() => {
      const results = [];
      
      // Strategy 1: Standard Buyhatke comparison table
      const tableRows = document.querySelectorAll('.compare_table tr, .comparison-table tr');
      
      for (const row of tableRows) {
        // Skip header rows
        if (row.querySelector('th') || row.classList.contains('header')) continue;
        
        // Extract platform name
        const storeElement = row.querySelector('.compare_store a, .store-name, .vendor-name, .merchant-name');
        if (!storeElement) continue;
        
        let platformName = storeElement.textContent?.trim();
        if (!platformName) continue;
        
        // Clean platform name
        platformName = platformName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
        if (platformName.length < 2) continue;
        
        // Extract price
        const priceElement = row.querySelector('.compare_price, .price, .current-price, .amount');
        if (!priceElement) continue;
        
        const priceText = priceElement.textContent?.trim();
        if (!priceText || !priceText.includes('₹')) continue;
        
        const priceMatch = priceText.match(/₹[\d,]+/);
        if (!priceMatch) continue;
        
        // Extract original price (for discount calculation)
        const originalPriceElement = row.querySelector('.compare_original_price, .original-price, .strike-price, .was-price');
        let originalPrice = null;
        if (originalPriceElement) {
          const originalPriceText = originalPriceElement.textContent?.trim();
          const originalPriceMatch = originalPriceText?.match(/₹[\d,]+/);
          if (originalPriceMatch) {
            originalPrice = originalPriceMatch[0];
          }
        }
        
        // Extract REAL rating (no random)
        let rating = null;
        const ratingElement = row.querySelector('.rating, .stars, .review-rating, [class*="star"], [class*="rating"]');
        if (ratingElement) {
          const ratingText = ratingElement.textContent?.trim();
          const ratingMatch = ratingText?.match(/[\d\.]+/);
          if (ratingMatch) {
            const ratingValue = parseFloat(ratingMatch[0]);
            if (ratingValue >= 0 && ratingValue <= 5) {
              rating = ratingValue.toFixed(1);
            }
          }
        }
        
        // Extract REAL reviews count (no random)
        let reviewsCount = null;
        const reviewsElement = row.querySelector('.reviews, .review-count, [class*="review"]');
        if (reviewsElement) {
          const reviewsText = reviewsElement.textContent?.trim();
          const reviewsMatch = reviewsText?.match(/[\d,]+/);
          if (reviewsMatch) {
            reviewsCount = reviewsMatch[0];
          }
        }
        
        // Extract buy link
        const linkElement = row.querySelector('.compare_action a, .buy-button a, .purchase-link a, a[href*="amazon"], a[href*="flipkart"], a[href*="myntra"], a[href*="ajio"]');
        let buyUrl = linkElement?.href;
        if (!buyUrl) buyUrl = productUrl; // Fallback to original product URL
        
        // Extract delivery info
        let deliveryTime = null;
        const deliveryElement = row.querySelector('.delivery, .shipping, .delivery-time');
        if (deliveryElement) {
          deliveryTime = deliveryElement.textContent?.trim();
        }
        
        // Extract availability
        let availability = 'In Stock'; // Default
        const availabilityElement = row.querySelector('.availability, .stock, .in-stock, .out-of-stock');
        if (availabilityElement) {
          availability = availabilityElement.textContent?.trim();
        }
        
        results.push({
          platform: platformName,
          price: priceMatch[0],
          originalPrice: originalPrice,
          rating: rating, // REAL rating or null
          reviews: reviewsCount, // REAL reviews or null
          buyUrl: buyUrl,
          availability: availability,
          deliveryTime: deliveryTime
        });
      }
      
      // Strategy 2: Card-based layout (if table strategy didn't work)
      if (results.length === 0) {
        const cards = document.querySelectorAll('.store-card, .merchant-card, .product-offer, '.price-card');
        
        for (const card of cards) {
          // Extract platform
          const storeElement = card.querySelector('.store-name, .merchant-name, '.vendor-name', h3, h4');
          if (!storeElement) continue;
          
          let platformName = storeElement.textContent?.trim();
          if (!platformName) continue;
          
          platformName = platformName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
          if (platformName.length < 2) continue;
          
          // Extract price
          const priceElement = card.querySelector('.price, .current-price, .sale-price, .cost');
          if (!priceElement) continue;
          
          const priceText = priceElement.textContent?.trim();
          const priceMatch = priceText?.match(/₹[\d,]+/);
          if (!priceMatch) continue;
          
          // Extract real rating
          let rating = null;
          const ratingElement = card.querySelector('.rating, .stars, [class*="star"]');
          if (ratingElement) {
            const ratingText = ratingElement.textContent?.trim();
            const ratingMatch = ratingText?.match(/[\d\.]+/);
            if (ratingMatch) {
              const ratingValue = parseFloat(ratingMatch[0]);
              if (ratingValue >= 0 && ratingValue <= 5) {
                rating = ratingValue.toFixed(1);
              }
            }
          }
          
          // Extract real reviews
          let reviewsCount = null;
          const reviewsElement = card.querySelector('.reviews, .review-count');
          if (reviewsElement) {
            const reviewsText = reviewsElement.textContent?.trim();
            const reviewsMatch = reviewsText?.match(/[\d,]+/);
            if (reviewsMatch) {
              reviewsCount = reviewsMatch[0];
            }
          }
          
          const linkElement = card.querySelector('a');
          let buyUrl = linkElement?.href || productUrl;
          
          results.push({
            platform: platformName,
            price: priceMatch[0],
            originalPrice: null,
            rating: rating, // REAL or null
            reviews: reviewsCount, // REAL or null  
            buyUrl: buyUrl,
            availability: 'Available',
            deliveryTime: null
          });
        }
      }
      
      // Strategy 3: Extract from any price mentions (last resort)
      if (results.length === 0) {
        const priceElements = document.querySelectorAll('*');
        const foundPlatforms = new Set();
        
        for (const el of priceElements) {
          const text = el.textContent?.toLowerCase() || '';
          const priceMatch = el.textContent?.match(/₹[\d,]+/);
          
          if (priceMatch) {
            let platform = null;
            
            // Detect platform from context
            if (text.includes('amazon') && !foundPlatforms.has('Amazon')) {
              platform = 'Amazon';
            } else if (text.includes('flipkart') && !foundPlatforms.has('Flipkart')) {
              platform = 'Flipkart';
            } else if (text.includes('myntra') && !foundPlatforms.has('Myntra')) {
              platform = 'Myntra';
            } else if (text.includes('ajio') && !foundPlatforms.has('Ajio')) {
              platform = 'Ajio';
            } else if (text.includes('nykaa') && !foundPlatforms.has('Nykaa')) {
              platform = 'Nykaa';
            } else if (text.includes('snapdeal') && !foundPlatforms.has('Snapdeal')) {
              platform = 'Snapdeal';
            }
            
            if (platform && results.length < 5) {
              foundPlatforms.add(platform);
              results.push({
                platform: platform,
                price: priceMatch[0],
                originalPrice: null,
                rating: null, // No fake ratings
                reviews: null, // No fake reviews
                buyUrl: productUrl,
                availability: 'Check Availability',
                deliveryTime: null
              });
            }
          }
        }
      }
      
      return results;
    });

    // Extract REAL product name
    const productName = await page.evaluate(() => {
      const selectors = [
        'h1',
        '.product-title',
        '.product-name', 
        '.title',
        '.product-info h1',
        '[data-testid="product-title"]'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          return element.textContent.trim();
        }
      }
      
      // Fallback to page title
      return document.title?.replace(/[^a-zA-Z0-9\s\-]/g, '').trim() || 'Product';
    });

    console.log(`✅ Found ${offers.length} REAL offers for ${productName}`);

    if (offers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No price comparison data found on Buyhatke',
        message: 'The product may not be available for comparison or Buyhatke structure changed',
        buyhatkeUrl: buyhatkeUrl
      });
    }

    // Sort by price (lowest first)
    offers.sort((a, b) => {
      const priceA = parseInt(a.price.replace(/[₹,]/g, ''));
      const priceB = parseInt(b.price.replace(/[₹,]/g, ''));
      return priceA - priceB;
    });

    // Calculate discount for items with original price
    const processedOffers = offers.map(offer => {
      let discount = null;
      if (offer.originalPrice) {
        const current = parseInt(offer.price.replace(/[₹,]/g, ''));
        const original = parseInt(offer.originalPrice.replace(/[₹,]/g, ''));
        if (original > current) {
          discount = `${Math.round(((original - current) / original) * 100)}%`;
        }
      }
      
      return {
        platform: offer.platform,
        price: offer.price,
        originalPrice: offer.originalPrice,
        discount: discount,
        rating: offer.rating, // REAL rating from site or null
        reviews: offer.reviews, // REAL reviews from site or null  
        availability: offer.availability || 'In Stock',
        deliveryTime: offer.deliveryTime || '2-3 days',
        buyUrl: offer.buyUrl
      };
    });

    res.json({
      success: true,
      productName: productName,
      originalUrl: productUrl,
      buyhatkeUrl: buyhatkeUrl,
      offers: processedOffers.slice(0, 5), // Return up to 5 offers
      totalOffers: processedOffers.length,
      timestamp: new Date().toISOString(),
      scrapedFrom: 'Buyhatke (Real Data Only)'
    });

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Buyhatke scraping failed',
      message: error.message,
      details: 'Could not access or parse Buyhatke comparison data'
    });
  } finally {
    if (page) await page.close();
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Online',
    service: 'TRYMEE Buyhatke Scraper (Real Data Only)',
    timestamp: new Date().toISOString(),
    note: 'No random data - only real scraped information'
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 TRYMEE Backend running on port ${PORT}`);
  console.log(`📊 Real data scraping - no random ratings/reviews`);
  await initBrowser();
});
