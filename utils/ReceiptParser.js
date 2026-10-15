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

  async parseReceipt(base64Image) {
    try {
      // 1. First attempt: Optical Character Recognition (OCR)
      const extractedText = await this.performOCR(base64Image);
      if (extractedText && extractedText.trim().length > 0) {
        const enrichedData = await this.analyzeWithGemini(extractedText);
        if (enrichedData && enrichedData.amount > 0) {
          return enrichedData;
        }
      }

      // 2. Second attempt: Direct Multimodal AI Vision
      const visionData = await this.analyzeWithVision(base64Image);
      if (visionData && visionData.amount > 0) {
        return visionData;
      }

      // 3. Third attempt: If text was found but amount was 0, return regex-parsed text
      if (extractedText && extractedText.trim().length > 0) {
        return this.regexFallback(extractedText);
      }

      return {
        amount: 0,
        category: 'Other',
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

  async analyzeWithVision(base64Image) {
    try {
      const config = await this._getConfig();
      const rawBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

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
                  text: `Analyze this receipt image and extract:\nAMOUNT:total amount (number only)\nCATEGORY:one of [${CATEGORIES.EXPENSE.join(', ')}]\nACCOUNT:one of [${ACCOUNTS.join(', ')}]\nMERCHANT:store/vendor name\nDATE:YYYY-MM-DD`
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
            return this.parseGeminiResponse(responseText, 'Vision scan');
          }
        }
      }
    } catch (e) {
      console.warn('Vision analysis warning:', e.message);
    }
    return null;
  }

  async analyzeWithGemini(text) {
    const config = await this._getConfig();

    const prompt = `
      Analyze this receipt text and extract:
      1. Total amount (just the number)
      2. Most appropriate category from this list: ${CATEGORIES.EXPENSE.join(', ')}
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
      
      If you can't determine any field, use these defaults:
      - Category: Other
      - Account: Cash
      - Merchant: Unknown
      - Date: current date
      - Items: Unknown items
    `;

    // 1. Try Grok (xAI) if key is present (in GROK_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY)
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
          if (response) return this.parseGeminiResponse(response, text);
        }
      } catch (err) {
        console.warn('Grok receipt analysis failed:', err.message);
      }
    }

    // 2. Try Gemini API if key is present (and not an xai- key)
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
          if (response) return this.parseGeminiResponse(response, text);
        }
      } catch (err) {
        console.warn('Gemini receipt analysis failed:', err.message);
      }
    }

    // 3. Try OpenAI API if key is present
    if (config.openaiApiKey && !config.openaiApiKey.startsWith('xai-')) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: config.openaiModel,
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
          if (response) return this.parseGeminiResponse(response, text);
        }
      } catch (err) {
        console.warn('OpenAI receipt analysis failed:', err.message);
      }
    }

    // 4. Offline Fallback: Extract amount and merchant with robust regex
    return this.regexFallback(text);
  }

  regexFallback(text) {
    if (!text || typeof text !== 'string') {
      return {
        amount: 0,
        category: 'Other',
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

    const firstLine = text.split('\n').map(l => l.trim()).filter(l => l.length > 2)[0] || 'Receipt';

    return {
      amount,
      category: 'Other',
      account: 'Cash',
      merchant: firstLine.slice(0, 30),
      date: new Date().toISOString(),
      items: [],
      notes: `📍 ${firstLine.slice(0, 30)}`
    };
  }

  parseGeminiResponse(response, originalText) {
    const lines = response.split('\n');
    const details = {
      amount: 0,
      category: 'Other',
      account: 'Cash',
      merchant: 'Unknown',
      date: new Date().toISOString(),
      items: [],
      notes: ''
    };

    for (const line of lines) {
      const [key, value] = line.split(':');
      if (!value) continue;

      switch (key.trim().toUpperCase()) {
        case 'AMOUNT':
          details.amount = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          break;
        case 'CATEGORY':
          if (CATEGORIES.EXPENSE.includes(value.trim())) {
            details.category = value.trim();
          }
          break;
        case 'ACCOUNT':
          if (ACCOUNTS.includes(value.trim())) {
            details.account = value.trim();
          }
          break;
        case 'MERCHANT':
          details.merchant = value.trim();
          break;
        case 'DATE':
          const parsedDate = new Date(value.trim());
          if (!isNaN(parsedDate.getTime())) {
            details.date = parsedDate.toISOString();
          }
          break;
        case 'ITEMS':
          details.items = value.split(',').map(item => item.trim());
          break;
      }
    }

    // Create a detailed summary note
    const notesParts = [];
    
    // Add merchant info
    if (details.merchant !== 'Unknown') {
      notesParts.push(`📍 ${details.merchant}`);
    }

    // Add items if available
    if (details.items && details.items.length > 0 && details.items[0] !== 'Unknown items') {
      notesParts.push(`🛍️ ${details.items.join(', ')}`);
    }

    // Add payment method if not cash
    if (details.account !== 'Cash') {
      notesParts.push(`💳 Paid via ${details.account}`);
    }

    // Combine all parts with line breaks
    details.notes = notesParts.join('\n');

    return details;
  }
}

export default ReceiptParser;