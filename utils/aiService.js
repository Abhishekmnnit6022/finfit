// aiService.js
import remoteConfig from './remoteConfig.js';

async function getAiConfig() {
    await remoteConfig.initialize();
    return {
        grokApiKey: remoteConfig.get('GROK_API_KEY'),
        grokModel: remoteConfig.get('GROK_MODEL') || 'grok-2-mini',
        geminiApiKey: remoteConfig.get('GEMINI_API_KEY'),
        geminiModel: remoteConfig.get('GEMINI_MODEL') || 'gemini-1.5-flash',
        openaiApiKey: remoteConfig.get('OPENAI_API_KEY'),
        openaiModel: remoteConfig.get('OPENAI_MODEL') || 'gpt-4o-mini',
    };
}

async function runAiChat(messages, { temperature = 0.4 } = {}) {
    const config = await getAiConfig();

    // 1. Check for Grok (xAI) API key
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
                    messages,
                    temperature,
                })
            });
            if (res.ok) {
                const data = await res.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) return content;
            } else {
                const errData = await res.json().catch(() => ({}));
                console.warn('Grok chat response status:', res.status, errData?.error || errData?.code || '');
            }
        } catch (err) {
            console.warn('Grok chat network notice:', err?.message);
        }
    }

    // 2. Check for Gemini API key
    if (config.geminiApiKey && !config.geminiApiKey.startsWith('xai-')) {
        try {
            const modelName = config.geminiModel || 'gemini-1.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

            // Combine messages into clean prompt for Gemini
            const combinedPrompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: combinedPrompt }] }],
                    generationConfig: { temperature }
                })
            });
            if (res.ok) {
                const data = await res.json();
                const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (geminiText) return geminiText;
            } else {
                console.warn('Gemini chat response status:', res.status);
            }
        } catch (err) {
            console.warn('Gemini chat network notice:', err?.message);
        }
    }

    // 3. Check for standard OpenAI API key
    if (config.openaiApiKey && config.openaiApiKey.startsWith('sk-')) {
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.openaiApiKey}`,
                },
                body: JSON.stringify({
                    model: config.openaiModel || 'gpt-4o-mini',
                    messages,
                    temperature,
                })
            });
            if (res.ok) {
                const data = await res.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) return content;
            } else {
                console.warn('OpenAI chat response status:', res.status);
            }
        } catch (err) {
            console.warn('OpenAI chat network notice:', err?.message);
        }
    }

    // Return null instead of throwing, so the smart student financial advisor engine takes over gracefully
    return null;
}

const formatWithLineBreaks = (text) => {
    if (!text) return '';
    let cleaned = text;
    // Replace markdown headers
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    // Replace markdown bold+italic (***text***) with just the text
    cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
    // Replace markdown bold (**text**) with just the text
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    // Replace markdown italic (*text*) with just the text
    cleaned = cleaned.replace(/\*([^*\n]+)\*/g, '$1');
    // Replace markdown bullet points (* item or - item) with clean bullet
    cleaned = cleaned.replace(/^(\s*)[\*\-]\s+/gm, '$1• ');
    // Remove ANY remaining stray asterisks
    cleaned = cleaned.replace(/\*/g, '');
    // Clean up excessive empty lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
};

/**
 * Intelligent Local Financial Analysis Engine for Indian College Students.
 * Generates actionable, data-driven financial advice from real user numbers.
 */
function generateLocalStudentAnalysis(summary = {}, transactions = []) {
    const totalIncome = parseFloat(summary?.totalIncome || 0);
    const totalExpense = parseFloat(summary?.totalExpense || 0);
    const balance = parseFloat(summary?.balance || (totalIncome - totalExpense));

    // Category spending aggregation
    const catTotals = {};
    if (Array.isArray(transactions)) {
        transactions.forEach(t => {
            if (t.type === 'EXPENSE' || !t.type) {
                const cat = t.category || 'General';
                const amt = parseFloat(t.amount || 0);
                catTotals[cat] = (catTotals[cat] || 0) + amt;
            }
        });
    }

    // Find top spending category
    let topCat = 'General';
    let topCatAmount = 0;
    Object.keys(catTotals).forEach(cat => {
        if (catTotals[cat] > topCatAmount) {
            topCatAmount = catTotals[cat];
            topCat = cat;
        }
    });

    const topCatPercent = totalExpense > 0 ? Math.round((topCatAmount / totalExpense) * 100) : 0;
    const weeklyDiscretionaryCap = totalIncome > 0 ? Math.round((totalIncome * 0.3) / 4) : 1000;

    const lines = [
        '💸 Overall spending patterns',
        `• Total logged expenses: ₹${totalExpense.toFixed(0)} across ${transactions.length || 0} transactions.`,
        topCatAmount > 0 
            ? `• Your highest spending area is ${topCat} (₹${topCatAmount.toFixed(0)}, ~${topCatPercent}% of total expenses).` 
            : `• Keep logging daily canteen, transit, and study expenses to spot patterns.`,
        '',
        '⚠️ Key areas of concern',
        topCatPercent > 40 
            ? `• ${topCat} takes up ${topCatPercent}% of your spending. High concentration in one category can quickly deplete monthly pocket money.` 
            : `• Watch out for micro-spends like daily chai, snacks, and delivery fees—they add up fast over a month.`,
        totalExpense > totalIncome && totalIncome > 0
            ? `• Alert: Your expenses currently exceed your recorded income by ₹${(totalExpense - totalIncome).toFixed(0)}.`
            : `• Avoid impulsive peer-pressure spending on weekends and outings.`,
        '',
        '🌟 Positive financial habits',
        `• Consistently recording your transactions is the single best foundation for financial freedom!`,
        balance > 0 
            ? `• Healthy surplus: You currently have ₹${balance.toFixed(0)} remaining balance.` 
            : `• You are actively monitoring your cashflow, which puts you ahead of 90% of students.`,
        '',
        '💡 Actionable suggestion',
        `• Set a weekly cap of ₹${weeklyDiscretionaryCap} for food & entertainment. When the week's cap is reached, stick to campus mess or free activities.`,
        `• Save at least 10% to 20% of any pocket money or stipend before planning non-essential expenses.`
    ];

    return lines.join('\n');
}

/**
 * Intelligent Local Chat Advisor for Indian College Students.
 * Responds to student queries with helpful, practical financial mentorship.
 */
function generateLocalChatResponse(message = '', summary = {}, transactions = []) {
    const lower = (message || '').toLowerCase();
    const totalIncome = parseFloat(summary?.totalIncome || 0);
    const totalExpense = parseFloat(summary?.totalExpense || 0);
    const balance = parseFloat(summary?.balance || 0);

    if (lower.includes('save') || lower.includes('saving')) {
        return [
            '💰 Student Saving Strategy 🎯',
            '',
            '• The Student 50/30/20 Rule:',
            '  - 50% for Essentials (Mess, fees, transit, room rent, course materials)',
            '  - 30% for Fun & Social (Canteen, weekend outings, subscriptions)',
            '  - 20% for Emergency Savings (Store in a high-yield savings account or liquid fund)',
            '',
            '• The 48-Hour Impulse Rule: For any online buy over ₹500, wait 48 hours. 70% of the time, the urge will fade!',
            '• Use student discounts on Amazon Prime, Spotify, and software tools to save ₹2,000+ per year.'
        ].join('\n');
    }

    if (lower.includes('budget') || lower.includes('plan')) {
        return [
            '📊 Simple 3-Step Student Budget 📝',
            '',
            '• Step 1: Divide your monthly allowance into 4 equal weekly buckets.',
            '• Step 2: Pay essentials first (recharges, room dues, books) at the start of the month.',
            '• Step 3: Never roll over overspending into the next week—if you spend extra this week, tighten the belt for the remaining 3 days.',
            '',
            `• Current Status: You have logged ₹${totalExpense.toFixed(0)} in expenses with ₹${balance.toFixed(0)} balance remaining.`
        ].join('\n');
    }

    if (lower.includes('food') || lower.includes('canteen') || lower.includes('zomato') || lower.includes('swiggy')) {
        return [
            '🍔 Smarter Food & Canteen Spending 💡',
            '',
            '• Canteen & delivery fees are the #1 budget killer for hostelers and college students.',
            '• Tip: Stick to hostel mess or home-cooked meals Monday through Friday, and treat yourself on weekends.',
            '• Order food together in groups to split delivery charges and use promo coupons.',
            '• Keep basic healthy snacks (peanuts, fruits, makhana) in your room so you do not order food when mildly hungry at night.'
        ].join('\n');
    }

    if (lower.includes('earn') || lower.includes('income') || lower.includes('pocket money') || lower.includes('invest')) {
        return [
            '🚀 Student Income & Investing Tips 📈',
            '',
            '• Skill Building: The highest ROI investment in college is building in-demand skills (coding, design, writing, video editing).',
            '• Freelance/Internships: Take up part-time campus gigs, tutoring junior students, or freelance projects.',
            '• Micro-Investing: Once you build an emergency fund of ₹3,000 - ₹5,000, consider starting a ₹500/month index fund SIP to learn how compounding works over time.'
        ].join('\n');
    }

    // Default student advisor response
    return [
        '🎓 FinFit Student Advisor 💬',
        '',
        '• Based on your financial records:',
        `  - Total Logged Expenses: ₹${totalExpense.toFixed(0)}`,
        `  - Total Logged Income: ₹${totalIncome.toFixed(0)}`,
        `  - Current Balance: ₹${balance.toFixed(0)}`,
        '',
        '• Top Recommendation:',
        '  - Track every expense right when you pay to maintain clear financial vision.',
        '  - Keep discretionary spends under control during the middle of the month.',
        '',
        'Feel free to ask me: "How to save money?", "Help me budget for this week", or "How to cut food expenses"!'
    ].join('\n');
}

const getInitialAnalysis = async (summary, transactions) => {
    const analysisPrompt = `As a financial advisor for Indian college students, analyze this financial data and provide a brief initial assessment. Use pointers and emojis to make it easy to read:

Summary: ${JSON.stringify(summary)}
Transactions: ${JSON.stringify(transactions)}

Provide a concise analysis covering:
1. Overall spending patterns 💸
2. Key areas of concern ⚠️
3. Positive financial habits 🌟
4. One specific actionable suggestion 💡

Keep it friendly and focused on the student context.`;

    try {
        const text = await runAiChat([
            { role: 'system', content: 'You are a concise, friendly financial advisor for Indian college students. Use bullet points (•) and emojis. IMPORTANT: Do NOT use any markdown formatting. No asterisks (*), no bold (**), no italic (*). Use plain text only.' },
            { role: 'user', content: analysisPrompt }
        ], { temperature: 0.4 });

        if (text) {
            return formatWithLineBreaks(text);
        }
    } catch (error) {
        console.warn('AI analysis notice (activating smart advisor engine):', error?.message);
    }

    // High quality student financial analysis based on user data
    return generateLocalStudentAnalysis(summary, transactions);
};

const chatWithAI = async (message, summary, transactions) => {
    const contextPrompt = `You are a financial advisor for Indian college students. Here is the current financial context. Respond using pointers and emojis for clarity:

Summary: ${JSON.stringify(summary)}
Transactions: ${JSON.stringify(transactions)}

Consider these student-specific factors when giving advice:
1. Monthly budget constraints with limited pocket money/part-time income
2. Common expenses: food/canteen, transport, study materials, entertainment
3. Peer pressure spending
4. Education-related costs
5. Basic savings goals

User message: ${message}

Provide specific, actionable advice in bullet points, with emojis where possible, that's relevant to Indian college students.`;

    try {
        const text = await runAiChat([
            { role: 'system', content: 'You are a helpful financial advisor for Indian college students. Use bullet points (•) and emojis. IMPORTANT: Do NOT use any markdown formatting. No asterisks (*), no bold (**), no italic (*). Use plain text only.' },
            { role: 'user', content: contextPrompt }
        ], { temperature: 0.5 });

        if (text) {
            return formatWithLineBreaks(text);
        }
    } catch (error) {
        console.warn('AI chat notice (activating smart advisor engine):', error?.message);
    }

    // High quality student chat response based on user message and data
    return generateLocalChatResponse(message, summary, transactions);
};

export { chatWithAI, getInitialAnalysis };
export default { chatWithAI, getInitialAnalysis };
