//ReceiptParser.js

import axios from 'axios';
import remoteConfig from './remoteConfig.js';

const CATEGORIES = {
  EXPENSE: [
    'Food & Dining',
    'Transportation',
    'Shopping',
    'Entertainment',
    'Bills & Utilities',
    'Health & Fitness',
    'Travel',
    'Education',
    'Other'
  ],
  INCOME: [
    'Salary',
    'Business',
    'Investments',
    'Freelance',
    'Gift',
    'Other'
  ],
  TRANSFER: [
    'Account Transfer',
    'Investment Transfer',
    'Debt Payment',
    'Other'
  ]
};

const ACCOUNTS = [
  'Cash',
  'Bank Account',
  'Credit Card',
  'Savings',
  'Investment'
];

class ReceiptParser {
  constructor() {}

  async _getConfig() {
    await remoteConfig.initialize();
    return {
      ocrApiKey: remoteConfig.get('OCR_API_KEY') || 'K85291492088957',
      grokApiKey: remoteConfig.get('GROK_API_KEY'),
      grokModel: remoteConfig.get('GROK_MODEL') || 'grok-2-mini',
      geminiApiKey: remoteConfig.get('GEMINI_API_KEY'),
      geminiModel: remoteConfig.get('GEMINI_MODEL') || 'gemini-1.5-flash',
      openaiApiKey: remoteConfig.get('OPENAI_API_KEY'),
      openaiModel: remoteConfig.get('OPENAI_MODEL') || 'gpt-4o-mini',
    };
  }

  inferCategory(text = '', merchant = '', items = [], customCategories = []) {
    const combined = `${merchant} ${items.join(' ')} ${text}`.toLowerCase();

    // Check custom categories first if any
    if (Array.isArray(customCategories)) {
      for (const cat of customCategories) {
        if (!cat || cat.toLowerCase() === 'other') continue;
        const catLower = cat.toLowerCase();
        if (combined.includes(catLower)) {
          return cat;
        }
      }
    }

    const rules = [
      {
        cat: 'Travel',
        keywords: [
          'berghotel', 'hotel', 'resort', 'motel', 'lodge', 'inn', 'hostel', 'stay',
          'homestay', 'booking.com', 'agoda', 'airbnb', 'flight', 'airline', 'indigo',
          'spicejet', 'air india', 'vistara', 'irctc', 'railway', 'train', 'makemytrip',
          'goibibo', 'cleartrip', 'yatra', 'travel', 'tourism', 'tour', 'visa', 'passport',
          'toll plaza', 'fastag', 'room service', 'checkout', 'check-in', 'suite'
        ]
      },
      {
        cat: 'Food & Dining',
        keywords: [
          'restaurant', 'cafe', 'coffee', 'tea', 'chai', 'bistro', 'bakery', 'bake',
          'kitchen', 'dhaba', 'mess', 'grill', 'pizza', 'burger', 'sandwich', 'swiggy',
          'zomato', 'mcdonald', 'kfc', 'starbucks', 'subway', 'domino', 'haldiram',
          'bikanervala', 'green', 'salad', 'veg', 'sweet', 'food', 'dine', 'dining',
          'breakfast', 'lunch', 'dinner', 'snack', 'bar', 'pub', 'brewery', 'eats',
          'catering', 'tiffin', 'canteen', 'ice cream', 'dessert', 'beverage', 'beer',
          'starters', 'thali', 'roti', 'biryani', 'curry', 'dosa', 'chai point'
        ]
      },
      {
        cat: 'Shopping',
        keywords: [
          'supermarket', 'hypermarket', 'mart', 'store', 'retail', 'mall', 'cloth',
          'clothing', 'apparel', 'fashion', 'garment', 'textile', 'dress', 'shirt',
          'pant', 'jeans', 'shoe', 'footwear', 'sneaker', 'zara', 'h&m', 'decathlon',
          'dmart', 'reliance', 'smart bazar', 'big bazaar', 'blinkit', 'instamart',
          'zepto', 'amazon', 'flipkart', 'myntra', 'meesho', 'nykaa', 'electronic',
          'mobile', 'gadget', 'jewel', 'watch', 'bookstore', 'stationery', 'hardware',
          'departmental', 'provisions', 'grocer', 'grocery', 'accessories'
        ]
      },
      {
        cat: 'Transportation',
        keywords: [
          'uber', 'ola', 'rapido', 'fuel', 'petrol', 'diesel', 'gas station', 'cng',
          'indian oil', 'ioc', 'bpcl', 'hpcl', 'shell', 'nayara', 'petroleum', 'taxi',
          'cab', 'auto', 'rickshaw', 'metro', 'bus', 'parking', 'toll', 'transit',
          'commute', 'fare', 'mechanic', 'garage', 'car wash'
        ]
      },
      {
        cat: 'Bills & Utilities',
        keywords: [
          'electricity', 'water', 'power', 'bescom', 'msedcl', 'tneb', 'uppcl',
          'broadband', 'wifi', 'internet', 'airtel', 'jio', 'vi', 'vodafone', 'bsnl',
          'recharge', 'dth', 'tata play', 'tata sky', 'bill', 'utility', 'maintenance',
          'society', 'gas bill', 'cylinder', 'indane', 'hp gas', 'bharat gas', 'postpaid'
        ]
      },
      {
        cat: 'Health & Fitness',
        keywords: [
          'hospital', 'pharmacy', 'chemist', 'medicine', 'medical', 'med', 'clinic',
          'doctor', 'healthcare', 'apollo', 'medplus', '1mg', 'pharmeasy', 'netmeds',
          'diagnostic', 'pathology', 'blood test', 'lab', 'dental', 'dentist', 'optical',
          'lenskart', 'eyewear', 'gym', 'fitness', 'cult', 'workout', 'yoga', 'physio'
        ]
      },
      {
        cat: 'Entertainment',
        keywords: [
          'cinema', 'movie', 'theatre', 'theater', 'multiplex', 'pvr', 'inox',
          'cinepolis', 'carnival', 'film', 'netflix', 'prime video', 'disney', 'hotstar',
          'spotify', 'apple music', 'youtube', 'gaana', 'wynk', 'concert', 'show',
          'event', 'bookmyshow', 'game', 'gaming', 'playstation', 'xbox', 'steam',
          'amusement', 'bowling', 'club'
        ]
      },
      {
        cat: 'Education',
        keywords: [
          'school', 'college', 'university', 'tuition', 'coaching', 'class', 'fee',
          'course', 'udemy', 'coursera', 'unacademy', 'byju', 'physics wallah', 'allen',
          'book', 'stationary', 'exam', 'admission', 'study', 'academy'
        ]
      }
    ];

    for (const rule of rules) {
      for (const kw of rule.keywords) {
        // Match whole word or reasonable substring
        const regex = new RegExp(`(?:^|[^a-z0-9])${kw}(?:$|[^a-z0-9])`, 'i');
        if (regex.test(combined)) {
          return rule.cat;
        }
      }
    }

    return 'Other';
  }

  async parseReceipt(base64Image, options = {}) {
    const targetCategories = options.categories || CATEGORIES.EXPENSE;
    try {
      // 1. First attempt: Optical Character Recognition (OCR)
      const extractedText = await this.performOCR(base64Image);
      if (extractedText && extractedText.trim().length > 0) {
        const enrichedData = await this.analyzeWithGemini(extractedText, options);
        if (enrichedData && enrichedData.amount > 0) {
          // If category is still 'Other', try semantic inference
          if (!enrichedData.category || enrichedData.category === 'Other') {
            const inferred = this.inferCategory(extractedText, enrichedData.merchant, enrichedData.items, targetCategories);
            if (inferred && inferred !== 'Other') {
              enrichedData.category = inferred;
            }
          }
          enrichedData.isAutoCategorized = Boolean(enrichedData.category && enrichedData.category !== 'Other');
          return enrichedData;
        }
      }

      // 2. Second attempt: Direct Multimodal AI Vision
      const visionData = await this.analyzeWithVision(base64Image, options);
      if (visionData && visionData.amount > 0) {
        if (!visionData.category || visionData.category === 'Other') {
          const inferred = this.inferCategory(extractedText || '', visionData.merchant, visionData.items, targetCategories);
          if (inferred && inferred !== 'Other') {
            visionData.category = inferred;
          }
        }
        visionData.isAutoCategorized = Boolean(visionData.category && visionData.category !== 'Other');
        return visionData;
      }

      // 3. Third attempt: Offline regex + semantic classifier
      if (extractedText && extractedText.trim().length > 0) {
        return this.regexFallback(extractedText, options);
      }

      return {
        amount: 0,
        category: 'Other',
        isAutoCategorized: false,
        account: 'Cash',
        merchant: 'Receipt',
        date: new Date().toISOString(),
        items: [],
        notes: 'Receipt scanned'
      };
    } catch (error) {
      console.warn('parseReceipt non-fatal fallback:', error.message);
      return {
        amount: 0,
        category: 'Other',
        isAutoCategorized: false,
        account: 'Cash',
        merchant: 'Receipt',
        date: new Date().toISOString(),
        items: [],
        notes: 'Receipt scanned'
      };
    }
  }

  async performOCR(base64Image) {
    const config = await this._getConfig();
    const apiKey = config.ocrApiKey || 'K85291492088957';

    // Ensure clean base64 data URI format
    const cleanBase64 = base64Image.startsWith('data:')
      ? base64Image
      : `data:image/jpeg;base64,${base64Image}`;

    // Try OCR Space with URLSearchParams (bypasses React Native multipart boundary bugs)
    const engines = ['2', '1'];
    for (const engine of engines) {
      try {
        const params = new URLSearchParams();
        params.append('apikey', apiKey);
        params.append('base64Image', cleanBase64);
        params.append('language', 'eng');
        params.append('detectOrientation', 'true');
        params.append('scale', 'true');
        params.append('OCREngine', engine);

        const response = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'apikey': apiKey,
          },
          body: params.toString(),
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.IsErroredOnProcessing && Array.isArray(data.ParsedResults) && data.ParsedResults.length > 0) {
            const text = data.ParsedResults[0].ParsedText || '';
            if (text.trim().length > 0) {
              return text;
            }
          }
        }
      } catch (err) {
        console.warn(`OCR Space engine ${engine} warning:`, err.message);
      }
    }

    return '';
  }

  async analyzeWithVision(base64Image, options = {}) {
    try {
      const config = await this._getConfig();
      const rawBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const validCategories = options.categories || CATEGORIES.EXPENSE;

      if (config.geminiApiKey && !config.geminiApiKey.startsWith('xai-')) {
        const modelName = config.geminiModel || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `Analyze this receipt image and extract:\nAMOUNT:total amount (number only)\nCATEGORY:one of [${validCategories.join(', ')}]\nACCOUNT:one of [${ACCOUNTS.join(', ')}]\nMERCHANT:store/vendor name\nDATE:YYYY-MM-DD\n\nChoose the most accurate category according to the vendor or items. Do not use 'Other' if a more specific category fits.`
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: rawBase64
                  }
                }
              ]
            }],
            generationConfig: { temperature: 0.1 }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            return this.parseGeminiResponse(responseText, 'Vision scan', options);
          }
        }
      }
    } catch (e) {
      console.warn('Vision analysis warning:', e.message);
    }
    return null;
  }

  async analyzeWithGemini(text, options = {}) {
    const config = await this._getConfig();
    const validCategories = options.categories || CATEGORIES.EXPENSE;

    const prompt = `
      Analyze this receipt text and extract:
      1. Total amount (just the number)
      2. Most appropriate category from this list: ${validCategories.join(', ')} (select the most accurate category based on the merchant and items, avoiding 'Other' whenever possible)
      3. Most likely payment method from this list: ${ACCOUNTS.join(', ')}
      4. Store/merchant name
      5. Date of purchase
      6. List of main items purchased (up to 3 items)
      
      Receipt text:
      ${text}

      Return ONLY in this exact format:
      AMOUNT:number
      CATEGORY:category
      ACCOUNT:account
      MERCHANT:name
      DATE:date
      ITEMS:item1, item2, item3
    `;

    // 1. Try Grok (xAI) if key is present
    const grokKey = config.grokApiKey || 
                    (config.openaiApiKey?.startsWith('xai-') ? config.openaiApiKey : null) ||
                    (config.geminiApiKey?.startsWith('xai-') ? config.geminiApiKey : null);
    if (grokKey) {
      try {
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${grokKey}`,
          },
          body: JSON.stringify({
            model: config.grokModel || 'grok-2-mini',
            messages: [
              { role: 'system', content: 'You extract structured data from receipts. Respond ONLY using the specified key:value format.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2
          })
        });
        if (res.ok) {
          const data = await res.json();
          const response = data.choices?.[0]?.message?.content || '';
          if (response) return this.parseGeminiResponse(response, text, options);
        }
      } catch (err) {
        console.warn('Grok receipt analysis failed:', err.message);
      }
    }

    // 2. Try Gemini API
    if (config.geminiApiKey && !config.geminiApiKey.startsWith('xai-')) {
      try {
        const modelName = config.geminiModel || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const response = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (response) return this.parseGeminiResponse(response, text, options);
        }
      } catch (err) {
        console.warn('Gemini receipt analysis failed:', err.message);
      }
    }

    // 3. Try OpenAI API
    if (config.openaiApiKey && !config.openaiApiKey.startsWith('xai-')) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: config.openaiModel || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You extract structured data from receipts. Respond ONLY using the specified key:value format.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2
          })
        });
        if (res.ok) {
          const data = await res.json();
          const response = data.choices?.[0]?.message?.content || '';
          if (response) return this.parseGeminiResponse(response, text, options);
        }
      } catch (err) {
        console.warn('OpenAI receipt analysis failed:', err.message);
      }
    }

    // 4. Offline Fallback: Extract amount, merchant, and semantically categorize
    return this.regexFallback(text, options);
  }

  regexFallback(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return {
        amount: 0,
        category: 'Other',
        isAutoCategorized: false,
        account: 'Cash',
        merchant: 'Receipt',
        date: new Date().toISOString(),
        items: [],
        notes: 'Receipt scanned'
      };
    }

    const patterns = [
      /(?:total|amount|net|paid|amt|grand\s*total)[\s:]*[$₹€£]?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i,
      /[$₹€£]\s*([0-9]+(?:[.,][0-9]{1,2})?)/,
      /(?:bal|balance)[\s:]*[$₹€£]?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i,
      /\b([0-9]{2,6}[.,][0-9]{2})\b/
    ];

    let amount = 0;
    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const val = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(val) && val > 0) {
          amount = val;
          break;
        }
      }
    }

    // If still no amount, find the maximum decimal number on receipt
    if (!amount) {
      const allNumbers = text.match(/\b[0-9]+[.,][0-9]{2}\b/g);
      if (allNumbers && allNumbers.length > 0) {
        const parsed = allNumbers.map(n => parseFloat(n.replace(',', '.'))).filter(n => !isNaN(n));
        if (parsed.length > 0) {
          amount = Math.max(...parsed);
        }
      }
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const firstLine = lines[0] || 'Receipt';
    const merchant = firstLine.replace(/[^a-zA-Z0-9\s&.-]/g, '').slice(0, 35).trim() || 'Receipt';

    const targetCategories = options.categories || CATEGORIES.EXPENSE;
    const inferredCategory = this.inferCategory(text, merchant, [], targetCategories);

    return {
      amount,
      category: inferredCategory,
      isAutoCategorized: inferredCategory !== 'Other',
      account: 'Cash',
      merchant,
      date: new Date().toISOString(),
      items: [],
      notes: `📍 ${merchant}`
    };
  }

  parseGeminiResponse(response, originalText, options = {}) {
    const lines = response.split('\n');
    const targetCategories = options.categories || CATEGORIES.EXPENSE;

    const details = {
      amount: 0,
      category: 'Other',
      isAutoCategorized: false,
      account: 'Cash',
      merchant: 'Unknown',
      date: new Date().toISOString(),
      items: [],
      notes: ''
    };

    for (const line of lines) {
      const [key, ...rest] = line.split(':');
      if (!rest || rest.length === 0) continue;
      const value = rest.join(':').trim();

      switch (key.trim().toUpperCase()) {
        case 'AMOUNT':
          details.amount = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          break;
        case 'CATEGORY':
          if (targetCategories.includes(value)) {
            details.category = value;
          }
          break;
        case 'ACCOUNT':
          if (ACCOUNTS.includes(value)) {
            details.account = value;
          }
          break;
        case 'MERCHANT':
          details.merchant = value;
          break;
        case 'DATE':
          const parsedDate = new Date(value);
          if (!isNaN(parsedDate.getTime())) {
            details.date = parsedDate.toISOString();
          }
          break;
        case 'ITEMS':
          details.items = value.split(',').map(item => item.trim()).filter(Boolean);
          break;
      }
    }

    // If category is still 'Other', try semantic inference
    if (!details.category || details.category === 'Other') {
      const inferred = this.inferCategory(originalText, details.merchant, details.items, targetCategories);
      if (inferred && inferred !== 'Other') {
        details.category = inferred;
      }
    }

    details.isAutoCategorized = Boolean(details.category && details.category !== 'Other');

    // Create a detailed summary note
    const notesParts = [];
    if (details.merchant && details.merchant !== 'Unknown') {
      notesParts.push(`📍 ${details.merchant}`);
    }
    if (details.items && details.items.length > 0 && details.items[0] !== 'Unknown items') {
      notesParts.push(`🛍️ ${details.items.join(', ')}`);
    }
    if (details.account !== 'Cash') {
      notesParts.push(`💳 Paid via ${details.account}`);
    }

    details.notes = notesParts.join('\n');
    return details;
  }
}

export default ReceiptParser;