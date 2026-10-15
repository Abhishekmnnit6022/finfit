import remoteConfig from './remoteConfig.js';

class GeminiTransactionParser {
  constructor({ model } = {}) {
    this.customModel = model;
  }

  async parseReceipt(text, options = {}) {
    await remoteConfig.initialize();

    const categories = options.categories || [
      'Food & Dining',
      'Transportation',
      'Shopping',
      'Entertainment',
      'Bills & Utilities',
      'Health & Fitness',
      'Travel',
      'Other',
    ];

    const accounts = options.accounts || [
      'Cash',
      'Bank Account',
      'Credit Card',
      'Savings',
      'Investment',
    ];

    const prompt = `Analyze the following receipt text and extract these details in a clear key:value format with one per line (Amount, Category, Account, Notes).\n\n- Amount (number only)\n- Category (choose from: ${categories.join(', ')})\n- Account (choose from: ${accounts.join(', ')})\n- Notes (optional, short vendor/store name)\n\nReceipt text:\n${text}`;

    // 1. Try Grok (xAI) if key is present (in GROK_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY)
    const grokKey = remoteConfig.get('GROK_API_KEY') || 
                    (remoteConfig.get('OPENAI_API_KEY')?.startsWith('xai-') ? remoteConfig.get('OPENAI_API_KEY') : null) ||
                    (remoteConfig.get('GEMINI_API_KEY')?.startsWith('xai-') ? remoteConfig.get('GEMINI_API_KEY') : null);
    if (grokKey) {
      try {
        const modelName = this.customModel || remoteConfig.get('GROK_MODEL') || 'grok-2-mini';
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${grokKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: 'You extract structured data from receipts. Respond using simple key:value pairs.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const grokText = data.choices?.[0]?.message?.content;
          if (grokText) {
            return this.parseLLMResponse(grokText);
          }
        }
      } catch (grokError) {
        console.warn('Grok parser failed, trying fallback:', grokError.message);
      }
    }

    // 2. Try Gemini API if key is present (and not an xai- key)
    const geminiKey = remoteConfig.get('GEMINI_API_KEY');
    if (geminiKey && !geminiKey.startsWith('xai-')) {
      try {
        const modelName = this.customModel || remoteConfig.get('GEMINI_MODEL') || 'gemini-3.8-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiKey)}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${prompt}` }] }],
            generationConfig: { temperature: 0.2 },
          }),
        });

        const data = await response.json();
        const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (geminiText) {
          return this.parseLLMResponse(geminiText);
        }
      } catch (geminiError) {
        console.warn('Gemini parser failed, trying fallback:', geminiError.message);
      }
    }

    // 3. Try OpenAI API if key is present
    const openAiKey = remoteConfig.get('OPENAI_API_KEY');
    if (openAiKey && !openAiKey.startsWith('xai-')) {
      try {
        const modelName = this.customModel || remoteConfig.get('OPENAI_MODEL') || 'gpt-4o-mini';
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: 'You extract structured data from receipts. Respond using simple key:value pairs.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const responseText = data.choices?.[0]?.message?.content || '';
          if (responseText) {
            return this.parseLLMResponse(responseText);
          }
        }
      } catch (openAiError) {
        console.warn('OpenAI parser failed:', openAiError.message);
      }
    }

    // 3. Resilient Regex Fallback (works offline without any API key!)
    return this.regexFallbackParse(text, categories, accounts);
  }

  regexFallbackParse(text, categories, accounts) {
    const details = {
      amount: 0,
      category: 'Other',
      account: 'Cash',
      notes: 'Receipt scan',
    };

    if (!text) return details;

    // Try finding total amount: Look for "Total", "Grand Total", "Amount", "Net", or currency numbers
    const totalMatch = text.match(/(?:total|grand\s*total|net\s*amount|amount|paid)[\s:]*[$₹€£]?\s*([0-9]+[.,][0-9]{2})/i) ||
                       text.match(/[$₹€£]\s*([0-9]+[.,][0-9]{2})/);
    if (totalMatch) {
      details.amount = parseFloat(totalMatch[1].replace(',', '.'));
    } else {
      // Find highest decimal number in receipt
      const numbers = text.match(/[0-9]+[.,][0-9]{2}/g);
      if (numbers && numbers.length > 0) {
        const parsedNums = numbers.map(n => parseFloat(n.replace(',', '.'))).filter(n => !isNaN(n));
        if (parsedNums.length > 0) {
          details.amount = Math.max(...parsedNums);
        }
      }
    }

    // Infer category
    const lower = text.toLowerCase();
    if (lower.includes('restaurant') || lower.includes('food') || lower.includes('cafe') || lower.includes('dining') || lower.includes('coffee') || lower.includes('pizza') || lower.includes('burger')) {
      details.category = 'Food & Dining';
    } else if (lower.includes('uber') || lower.includes('fuel') || lower.includes('petrol') || lower.includes('diesel') || lower.includes('taxi') || lower.includes('transport')) {
      details.category = 'Transportation';
    } else if (lower.includes('mart') || lower.includes('supermarket') || lower.includes('store') || lower.includes('retail') || lower.includes('cloth')) {
      details.category = 'Shopping';
    } else if (lower.includes('cinema') || lower.includes('movie') || lower.includes('theater')) {
      details.category = 'Entertainment';
    } else if (lower.includes('electric') || lower.includes('water') || lower.includes('bill') || lower.includes('gas') || lower.includes('internet')) {
      details.category = 'Bills & Utilities';
    } else if (lower.includes('hospital') || lower.includes('pharmacy') || lower.includes('med') || lower.includes('clinic')) {
      details.category = 'Health & Fitness';
    }

    // Infer notes: First non-empty line usually has the store/merchant name
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    if (lines.length > 0) {
      details.notes = lines[0].slice(0, 30);
    }

    return details;
  }

  parseLLMResponse(response) {
    const lines = (response || '').split('\n');
    const details = {};

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();

      if (key === 'amount') {
        details.amount = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
      } else if (key === 'category') {
        details.category = value;
      } else if (key === 'account') {
        details.account = value;
      } else if (key === 'notes' || key === 'note') {
        details.notes = value;
      }
    }

    return details;
  }
}

export default GeminiTransactionParser;