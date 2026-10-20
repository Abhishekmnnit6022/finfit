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

    // Return null so the local student financial advisor engine takes over seamlessly
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
 * Normalizes financial summary and transactions to guarantee exact calculations.
 * Always computes directly from transactions if summary figures are missing or zero.
 */
function normalizeFinancialData(summary = {}, transactions = []) {
    const txList = Array.isArray(transactions) ? transactions : [];

    let computedExpense = 0;
    let computedIncome = 0;
    const catTotals = {};

    txList.forEach(t => {
        const amt = parseFloat(t.amount || 0);
        const type = (t.type || '').toUpperCase();
        if (type === 'INCOME') {
            computedIncome += amt;
        } else {
            // Default to EXPENSE
            computedExpense += amt;
            const cat = t.category || 'General';
            catTotals[cat] = (catTotals[cat] || 0) + amt;
        }
    });

    const rawExpense = summary?.expense ?? summary?.totalExpense;
    const rawIncome = summary?.income ?? summary?.totalIncome;
    const rawBalance = summary?.total ?? summary?.balance;

    const parsedExpense = parseFloat(rawExpense);
    const parsedIncome = parseFloat(rawIncome);
    const parsedBalance = parseFloat(rawBalance);

    const totalExpense = !isNaN(parsedExpense) && parsedExpense > 0 ? parsedExpense : computedExpense;
    const totalIncome = !isNaN(parsedIncome) && parsedIncome > 0 ? parsedIncome : computedIncome;
    const balance = !isNaN(parsedBalance) ? parsedBalance : (totalIncome - totalExpense);

    return {
        totalExpense,
        totalIncome,
        balance,
        expense: totalExpense,
        income: totalIncome,
        total: balance,
        catTotals,
        txList
    };
}

function normalizeLang(lang) {
    if (!lang) return 'English';
    const l = String(lang).toLowerCase().trim();
    if (l.startsWith('hi') || l === 'hn') return 'Hindi';
    if (l.startsWith('ta') || l === 'tm') return 'Tamil';
    if (l.startsWith('ka') || l === 'kn') return 'Kannada';
    if (l.startsWith('mr')) return 'Marathi';
    if (l.startsWith('ur')) return 'Urdu';
    return 'English';
}

/**
 * Intelligent Local Financial Analysis Engine for Indian College Students.
 * Generates actionable, data-driven financial advice in the user's selected language.
 */
function generateLocalStudentAnalysis(summary = {}, transactions = [], language = 'English') {
    const lang = normalizeLang(language);
    const { totalExpense, totalIncome, balance, catTotals, txList } = normalizeFinancialData(summary, transactions);

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

    if (lang === 'Hindi') {
        const lines = [
            '💸 खर्च का विश्लेषण',
            `• कुल दर्ज खर्च: ₹${totalExpense.toFixed(0)} (${txList.length} लेनदेन में)।`,
            topCatAmount > 0 
                ? `• आपका सबसे बड़ा खर्च क्षेत्र ${topCat} है (₹${topCatAmount.toFixed(0)}, कुल खर्च का लगभग ${topCatPercent}%)।` 
                : `• पैटर्न देखने के लिए अपने दैनिक कैंटीन, यात्रा और अध्ययन खर्च दर्ज करते रहें।`,
            '',
            '⚠️ ध्यान देने योग्य बातें',
            topCatPercent > 40 
                ? `• ${topCat} पर आपका ${topCatPercent}% खर्च हो रहा है। एक ही श्रेणी में इतना खर्च पॉकेट मनी को जल्दी समाप्त कर सकता है।` 
                : `• छोटी-मोटी चाय, स्नैक्स और ऑनलाइन डिलीवरी शुल्क पर नज़र रखें—महीने के अंत में यह बहुत बढ़ जाते हैं।`,
            totalExpense > totalIncome && totalIncome > 0
                ? `• चेतावनी: आपका खर्च आपकी दर्ज आय से ₹${(totalExpense - totalIncome).toFixed(0)} अधिक है।`
                : `• सप्ताहांत पर बिना सोचे-समझे खर्च करने से बचें।`,
            '',
            '🌟 अच्छी वित्तीय आदतें',
            `• अपने खर्चों को नियमित रूप से दर्ज करना वित्तीय स्वतंत्रता की सबसे अच्छी शुरुआत है!`,
            balance > 0 
                ? `• सुरक्षित बचत: आपके पास वर्तमान में ₹${balance.toFixed(0)} शेष राशि बची है।` 
                : `• आप सक्रिय रूप से अपने बजट पर नज़र रख रहे हैं, जो एक बहुत अच्छी आदत है।`,
            '',
            '💡 व्यावहारिक सुझाव',
            `• भोजन और मनोरंजन के लिए प्रति सप्ताह ₹${weeklyDiscretionaryCap} की सीमा तय करें।`,
            `• किसी भी पॉकेट मनी या स्टाइपेंड का कम से कम 10% से 20% हिस्सा पहले बचाएं।`
        ];
        return lines.join('\n');
    }

    if (lang === 'Tamil') {
        const lines = [
            '💸 ஒட்டுமொத்த செலவு பகுப்பாய்வு',
            `• பதிவு செய்யப்பட்ட மொத்த செலவு: ₹${totalExpense.toFixed(0)} (${txList.length} பரிவர்த்தனைகள்).`,
            topCatAmount > 0 
                ? `• உங்கள் அதிகபட்ச செலவுப் பிரிவு ${topCat} (₹${topCatAmount.toFixed(0)}, மொத்த செலவில் ~${topCatPercent}%).` 
                : `• தினசரி கேன்டீன் மற்றும் படிப்பு செலவுகளைத் தொடர்ந்து பதிவு செய்யுங்கள்.`,
            '',
            '⚠️ கவனிக்க வேண்டிய பகுதிகள்',
            topCatPercent > 40 
                ? `• ${topCat} உங்கள் செலவில் ${topCatPercent}% எடுத்துக்கொள்கிறது. இது மாதாந்திர பணத்தை விரைவாகக் குறைக்கும்.` 
                : `• தினசரி தேநீர் மற்றும் சிறு சிற்றுண்டி செலவுகளை கவனியுங்கள்—மாத இறுதியில் இது பெரிதாக மாறும்.`,
            totalExpense > totalIncome && totalIncome > 0
                ? `• எச்சரிக்கை: உங்கள் செலவு உங்கள் வருமானத்தை விட ₹${(totalExpense - totalIncome).toFixed(0)} அதிகமாக உள்ளது.`
                : `• நண்பர்களின் வற்புறுத்தலால் செய்யும் வீண் செலவுகளைத் தவிர்க்கவும்.`,
            '',
            '🌟 சிறந்த நிதிப் பழக்கங்கள்',
            `• செலவுகளைத் தவறாமல் பதிவு செய்வது நிதி சுதந்திரத்திற்கான முதல் படியாகும்!`,
            balance > 0 
                ? `• ஆரோக்கியமான சேமிப்பு: உங்களிடம் ₹${balance.toFixed(0)} இருப்பு உள்ளது.` 
                : `• உங்கள் பணப்புழக்கத்தை கண்காணிப்பது உங்களை மற்ற மாணவர்களை விட முன்னணியில் வைக்கிறது.`,
            '',
            '💡 பயனுள்ள ஆலோசனை',
            `• உணவு மற்றும் பொழுதுபோக்கிற்கு வாரத்திற்கு ₹${weeklyDiscretionaryCap} வரம்பை நிர்ணயிக்கவும்.`,
            `• எந்தவொரு பாக்கெட் மணியிலும் குறைந்தபட்சம் 10% முதல் 20% வரை சேமிக்கவும்.`
        ];
        return lines.join('\n');
    }

    if (lang === 'Kannada') {
        const lines = [
            '💸 ಒಟ್ಟಾರೆ ಖರ್ಚಿನ ವಿಶ್ಲೇಷಣೆ',
            `• ಒಟ್ಟು ದಾಖಲಾದ ಖರ್ಚುಗಳು: ₹${totalExpense.toFixed(0)} (${txList.length} ವಹಿವಾಟುಗಳಲ್ಲಿ).`,
            topCatAmount > 0 
                ? `• ನಿಮ್ಮ ಅತ್ಯಧಿಕ ಖರ್ಚಿನ ವಿಭಾಗ ${topCat} (₹${topCatAmount.toFixed(0)}, ಒಟ್ಟು ಖರ್ಚಿನ ~${topCatPercent}%).` 
                : `• ಖರ್ಚಿನ ಮಾದರಿ ತಿಳಿಯಲು ದೈನಂದಿನ ಕ್ಯಾಂಟೀನ್ ಮತ್ತು ಅಧ್ಯಯನ ವೆಚ್ಚಗಳನ್ನು ದಾಖಲಿಸಿ.`,
            '',
            '⚠️ ಗಮನಿಸಬೇಕಾದ ಮುಖ್ಯ ಅಂಶಗಳು',
            topCatPercent > 40 
                ? `• ${topCat} ವಿಭಾಗಕ್ಕೆ ನಿಮ್ಮ ಖರ್ಚಿನ ${topCatPercent}% ವ್ಯಯವಾಗುತ್ತಿದೆ. ಇದು ಮಾಸಿಕ ಪಾಕೆಟ್ ಹಣವನ್ನು ಬೇಗನೆ ಮುಗಿಸಬಹುದು.` 
                : `• ಸಣ್ಣಪುಟ್ಟ ಚಹಾ, ತಿಂಡಿ ಮತ್ತು ಡೆಲಿವರಿ ಶುಲ್ಕಗಳನ್ನು ಗಮನಿಸಿ—ತಿಂಗಳ ಕೊನೆಗೆ ಇದು ದೊಡ್ಡ ಮೊತ್ತವಾಗುತ್ತದೆ.`,
            totalExpense > totalIncome && totalIncome > 0
                ? `• ಎಚ್ಚರಿಕೆ: ನಿಮ್ಮ ಖರ್ಚು ನಿಮ್ಮ ಆದಾಯಕ್ಕಿಂತ ₹${(totalExpense - totalIncome).toFixed(0)} ಹೆಚ್ಚಾಗಿದೆ.`
                : `• ವಾರಾಂತ್ಯದಲ್ಲಿ ಅನಗತ್ಯವಾಗಿ ಖರ್ಚು ಮಾಡುವುದನ್ನು ತಪ್ಪಿಸಿ.`,
            '',
            '🌟 ಉತ್ತಮ ಆರ್ಥಿಕ ಅಭ್ಯಾಸಗಳು',
            `• ನಿರಂತರವಾಗಿ ವಹಿವಾಟುಗಳನ್ನು ದಾಖಲಿಸುವುದು ಆರ್ಥಿಕ ಸ್ವಾತಂತ್ರ್ಯದ ಅತ್ಯುತ್ತಮ ಅಡಿಪಾಯವಾಗಿದೆ!`,
            balance > 0 
                ? `• ಆರೋಗ್ಯಕರ ಉಳಿತಾಯ: ನಿಮ್ಮ ಬಳಿ ₹${balance.toFixed(0)} ಉಳಿದ ಬಾಕಿ ಮೊತ್ತವಿದೆ.` 
                : `• ನೀವು ಹಣದ ಹರಿವನ್ನು ಗಮನಿಸುತ್ತಿದ್ದೀರಿ, ಇದು ನಿಮ್ಮನ್ನು ಬಹುತೇಕ ವಿದ್ಯಾರ್ಥಿಗಳಿಗಿಂತ ಮುಂದಿಡುತ್ತದೆ.`,
            '',
            '💡 ಕಾರ್ಯಸಾಧ್ಯ ಸಲಹೆ',
            `• ಆಹಾರ ಮತ್ತು ಮನರಂಜನೆಗಾಗಿ ವಾರಕ್ಕೆ ₹${weeklyDiscretionaryCap} ಮಿತಿ ನಿಗದಿಪಡಿಸಿ.`,
            `• ಯಾವುದೇ ಪಾಕೆಟ್ ಮನಿ ಅಥವಾ ಸ್ಟೈಫಂಡ್‌ನ ಕನಿಷ್ಠ 10% ರಿಂದ 20% ಉಳಿಸಿ.`
        ];
        return lines.join('\n');
    }

    if (lang === 'Marathi') {
        const lines = [
            '💸 एकूण खर्चाचे विश्लेषण',
            `• एकूण नोंदवलेला खर्च: ₹${totalExpense.toFixed(0)} (${txList.length} व्यवहारांमध्ये).`,
            topCatAmount > 0 
                ? `• तुमचा सर्वाधिक खर्च ${topCat} मध्ये आहे (₹${topCatAmount.toFixed(0)}, एकूण खर्चाच्या सुमारे ${topCatPercent}%).` 
                : `• नमुने समजण्यासाठी दैनंदिन कँटीन आणि अभ्यासाचा खर्च नोंदवत राहा.`,
            '',
            '⚠️ महत्त्वाच्या बाबी',
            topCatPercent > 40 
                ? `• ${topCat} वर तुमचा ${topCatPercent}% खर्च होत आहे. यामुळे महिन्याची पॉकेटमनी लवकर संपू शकते.` 
                : `• चहा आणि लहान-सहान डिलिव्हरी खर्चावर लक्ष ठेवा—महिन्याभरात हे पैसे खूप वाढतात.`,
            totalExpense > totalIncome && totalIncome > 0
                ? `• सूचना: तुमचा खर्च तुमच्या उत्पन्नापेक्षा ₹${(totalExpense - totalIncome).toFixed(0)} ने जास्त आहे.`
                : `• मित्रांच्या दबावात येऊन वीकेंडला अनावश्यक खर्च करणे टाळा.`,
            '',
            '🌟 चांगल्या आर्थिक सवयी',
            `• नियमितपणे खर्च नोंदवणे हे आर्थिक स्वातंत्र्याचे पहिले पाऊल आहे!`,
            balance > 0 
                ? `• चांगली बचत: सध्या तुमच्याकडे ₹${balance.toFixed(0)} शिल्लक रक्कम आहे.` 
                : `• तुम्ही तुमच्या पैशांचे नियोजन करत आहात, जे तुम्हाला 90% विद्यार्थ्यांपेक्षा पुढे ठेवते.`,
            '',
            '💡 उपयुक्त सल्ला',
            `• अन्न आणि मनोरंजनासाठी दर आठवड्याला ₹${weeklyDiscretionaryCap} ची मर्यादा ठरवा.`,
            `• पॉकेटमनी किंवा स्टायपेंडमधून किमान 10% ते 20% रक्कम आधी बचत करा.`
        ];
        return lines.join('\n');
    }

    if (lang === 'Urdu') {
        const lines = [
            '💸 اخراجات کا مجموعی تجزیہ',
            `• کل درج شدہ اخراجات: ₹${totalExpense.toFixed(0)} (${txList.length} لین دین میں)۔`,
            topCatAmount > 0 
                ? `• آپ کا سب سے زیادہ خرچ ${topCat} پر ہے (₹${topCatAmount.toFixed(0)}، کل اخراجات کا تقریباً ${topCatPercent}%)۔` 
                : `• اخراجات کے پیٹرن جاننے کے لیے روزانہ کینٹین اور تعلیمی اخراجات درج کرتے رہیں۔`,
            '',
            '⚠️ اہم توجہ طلب امور',
            topCatPercent > 40 
                ? `• ${topCat} آپ کے اخراجات کا ${topCatPercent}% لے رہا ہے۔ ایک ہی جگہ اتنا خرچ پاکٹ منی کو جلد ختم کر سکتا ہے۔` 
                : `• روزانہ چائے، اسنیکس اور ڈیلیوری فیس کا خیال رکھیں—ماہانہ حساب میں یہ بہت بڑھ جاتے ہیں۔`,
            totalExpense > totalIncome && totalIncome > 0
                ? `• انتباہ: آپ کے اخراجات آپ کی درج شدہ آمدنی سے ₹${(totalExpense - totalIncome).toFixed(0)} زیادہ ہیں۔`
                : `• دوستوں کے ساتھ ہفتہ وار چھٹیوں پر غیر ضروری اخراجات سے بچیں۔`,
            '',
            '🌟 مثبت مالی عادات',
            `• اپنے تمام لین دین کا مسلسل ریکارڈ رکھنا مالی خود مختاری کی بہترین بنیاد ہے!`,
            balance > 0 
                ? `• اچھی بچت: فی الحال آپ کے پاس ₹${balance.toFixed(0)} بقایا رقم موجود ہے۔` 
                : `• آپ فعال طور پر اپنے بجٹ پر نظر رکھے ہوئے ہیں، جو ایک شاندار عادت ہے۔`,
            '',
            '💡 عملی تجاویز',
            `• کھانے پینے اور تفریح کے لیے ہفتہ وار ₹${weeklyDiscretionaryCap} کی حد مقرر کریں۔`,
            `• پاکٹ منی یا وظیفے میں سے کم از کم 10% سے 20% لازمی بچائیں۔`
        ];
        return lines.join('\n');
    }

    // Default: English
    const lines = [
        '💸 Overall spending patterns',
        `• Total logged expenses: ₹${totalExpense.toFixed(0)} across ${txList.length} transactions.`,
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
 * Responds to student queries in their active language.
 */
function generateLocalChatResponse(message = '', summary = {}, transactions = [], language = 'English') {
    const lang = normalizeLang(language);
    const lower = (message || '').toLowerCase();
    const { totalExpense, totalIncome, balance, catTotals, txList } = normalizeFinancialData(summary, transactions);

    const isExpenseQuery = lower.includes('expense') || lower.includes('expnse') || lower.includes('spend') || 
                           lower.includes('spent') || lower.includes('cost') || lower.includes('paid') || 
                           lower.includes('kharcha') || lower.includes('how much') || lower.includes('खर्च') || 
                           lower.includes('செலவு') || lower.includes('ಖರ್ಚು') || lower.includes('اخراجات');
    
    const isSaveQuery = lower.includes('save') || lower.includes('saving') || lower.includes('बचत') || 
                        lower.includes('சேமிப்பு') || lower.includes('ಉಳಿತಾಯ') || lower.includes('بچت');

    const isBudgetQuery = lower.includes('budget') || lower.includes('plan') || lower.includes('बजट') || 
                          lower.includes('திட்டம்') || lower.includes('ಯೋಜನೆ') || lower.includes('بجٹ');

    const isFoodQuery = lower.includes('food') || lower.includes('canteen') || lower.includes('zomato') || 
                        lower.includes('swiggy') || lower.includes('खाना') || lower.includes('உணவு') || 
                        lower.includes('ಆಹಾರ') || lower.includes('जेवण') || lower.includes('کھانا');

    const isIncomeQuery = lower.includes('earn') || lower.includes('income') || lower.includes('pocket money') || 
                          lower.includes('invest') || lower.includes('कमाई') || lower.includes('வருமானம்') || 
                          lower.includes('ಆದಾಯ') || lower.includes('آمدنی');

    // 1. Expense Query
    if (isExpenseQuery) {
        const topCategories = Object.entries(catTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);

        if (lang === 'Hindi') {
            const catLines = topCategories.length > 0
                ? topCategories.map(([cat, amt]) => `  - ${cat}: ₹${amt.toFixed(0)} (${totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0}%)`)
                : ['  - अभी तक कोई वर्गीकृत खर्च नहीं'];
            return [
                '💳 खर्च का विवरण और सारांश 📊',
                '',
                `• कुल दर्ज खर्च: ₹${totalExpense.toFixed(0)} (${txList.length} लेनदेन में)`,
                `• वर्तमान शेष राशि: ₹${balance.toFixed(0)} (कुल आय: ₹${totalIncome.toFixed(0)})`,
                '',
                '🏷️ शीर्ष खर्च श्रेणियां:',
                ...catLines,
                '',
                '💡 वित्तीय सुझाव:',
                totalExpense > totalIncome && totalIncome > 0
                    ? '• ध्यान दें: आपका खर्च आपकी आय से अधिक है। गैर-जरूरी ऑनलाइन ऑर्डर सीमित करें।'
                    : '• 100% स्पष्टता बनाए रखने के लिए हर लेनदेन को तुरंत दर्ज करते रहें!'
            ].join('\n');
        }

        if (lang === 'Tamil') {
            const catLines = topCategories.length > 0
                ? topCategories.map(([cat, amt]) => `  - ${cat}: ₹${amt.toFixed(0)} (${totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0}%)`)
                : ['  - வகைப்படுத்தப்பட்ட செலவுகள் எதுவும் இல்லை'];
            return [
                '💳 செலவு விவரம் மற்றும் சுருக்கம் 📊',
                '',
                `• பதிவு செய்யப்பட்ட மொத்த செலவு: ₹${totalExpense.toFixed(0)} (${txList.length} பரிவர்த்தனைகள்)`,
                `• தற்போதைய இருப்பு: ₹${balance.toFixed(0)} (மொத்த வருமானம்: ₹${totalIncome.toFixed(0)})`,
                '',
                '🏷️ அதிக செலவுப் பிரிவுகள்:',
                ...catLines,
                '',
                '💡 நிதி ஆலோசனை:',
                totalExpense > totalIncome && totalIncome > 0
                    ? '• எச்சரிக்கை: உங்கள் செலவு வருமானத்தை விட அதிகமாக உள்ளது. அவசியமற்ற ஆர்டர்களைக் குறைக்கவும்.'
                    : '• தெளிவான நிதி நிர்வாகத்திற்கு அனைத்து செலவுகளையும் உடனடியாகப் பதிவு செய்யுங்கள்!'
            ].join('\n');
        }

        if (lang === 'Kannada') {
            const catLines = topCategories.length > 0
                ? topCategories.map(([cat, amt]) => `  - ${cat}: ₹${amt.toFixed(0)} (${totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0}%)`)
                : ['  - ಯಾವುದೇ ವರ್ಗೀಕೃತ ಖರ್ಚುಗಳಿಲ್ಲ'];
            return [
                '💳 ಖರ್ಚಿನ ವಿವರ ಮತ್ತು ಸಾರಾಂಶ 📊',
                '',
                `• ಒಟ್ಟು ದಾಖಲಾದ ಖರ್ಚುಗಳು: ₹${totalExpense.toFixed(0)} (${txList.length} ವಹಿವಾಟುಗಳು)`,
                `• ಪ್ರಸ್ತುತ ಬಾಕಿ: ₹${balance.toFixed(0)} (ಒಟ್ಟು ಆದಾಯ: ₹${totalIncome.toFixed(0)})`,
                '',
                '🏷️ ಪ್ರಮುಖ ಖರ್ಚಿನ ವರ್ಗಗಳು:',
                ...catLines,
                '',
                '💡 ಆರ್ಥಿಕ ಸಲಹೆ:',
                totalExpense > totalIncome && totalIncome > 0
                    ? '• ಗಮನಿಸಿ: ನಿಮ್ಮ ಖರ್ಚು ಆದಾಯಕ್ಕಿಂತ ಹೆಚ್ಚಾಗಿದೆ. ಅನಗತ್ಯ ಆನ್‌ಲೈನ್ ಆರ್ಡರ್‌ಗಳನ್ನು ನಿಯಂತ್ರಿಸಿ.'
                    : '• ಸಂಪೂರ್ಣ ಸ್ಪಷ್ಟತೆಗಾಗಿ ಪ್ರತಿಯೊಂದು ವಹಿವಾಟನ್ನು ತಕ್ಷಣವೇ ದಾಖಲಿಸಿ!'
            ].join('\n');
        }

        if (lang === 'Marathi') {
            const catLines = topCategories.length > 0
                ? topCategories.map(([cat, amt]) => `  - ${cat}: ₹${amt.toFixed(0)} (${totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0}%)`)
                : ['  - अजून कोणताही वर्गीकृत खर्च नाही'];
            return [
                '💳 खर्चाचा तपशील आणि सारांश 📊',
                '',
                `• एकूण नोंदवलेला खर्च: ₹${totalExpense.toFixed(0)} (${txList.length} व्यवहारांमध्ये)`,
                `• सध्याची शिल्लक: ₹${balance.toFixed(0)} (एकूण उत्पन्न: ₹${totalIncome.toFixed(0)})`,
                '',
                '🏷️ शीर्ष खर्च श्रेणी:',
                ...catLines,
                '',
                '💡 आर्थिक सल्ला:',
                totalExpense > totalIncome && totalIncome > 0
                    ? '• सूचना: तुमचा खर्च उत्पन्नापेक्षा जास्त आहे. अनावश्यक ऑनलाइन खरेदी थांबवा.'
                    : '• १००% पारदर्शकतेसाठी प्रत्येक व्यवहार त्वरित नोंदवत राहा!'
            ].join('\n');
        }

        if (lang === 'Urdu') {
            const catLines = topCategories.length > 0
                ? topCategories.map(([cat, amt]) => `  - ${cat}: ₹${amt.toFixed(0)} (${totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0}%)`)
                : ['  - ابھی تک کوئی زمرہ بندی نہیں کی گئی'];
            return [
                '💳 اخراجات کی تفصیل اور خلاصہ 📊',
                '',
                `• کل درج شدہ اخراجات: ₹${totalExpense.toFixed(0)} (${txList.length} لین دین میں)`,
                `• موجودہ بیلنس: ₹${balance.toFixed(0)} (کل آمدنی: ₹${totalIncome.toFixed(0)})`,
                '',
                '🏷️ نمایاں اخراجات کے زمرے:',
                ...catLines,
                '',
                '💡 مالی مشورہ:',
                totalExpense > totalIncome && totalIncome > 0
                    ? '• توجہ فرمائیں: آپ کے اخراجات آمدنی سے تجاوز کر رہے ہیں۔ غیر ضروری آرڈرز پر قابو پائیں۔'
                    : '• مکمل مالی شفافیت کے لیے ہر لین دین فوری طور پر ریکارڈ کریں!'
            ].join('\n');
        }

        // Default English
        const categoryBreakdownLines = topCategories.length > 0
            ? topCategories.map(([cat, amt]) => {
                const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
                return `  - ${cat}: ₹${amt.toFixed(0)} (${pct}%)`;
              })
            : ['  - No categorized expenses yet'];

        return [
            '💳 Expense Breakdown & Summary 📊',
            '',
            `• Total Logged Expenses: ₹${totalExpense.toFixed(0)} across ${txList.length} transactions.`,
            `• Current Balance: ₹${balance.toFixed(0)} (Total Income: ₹${totalIncome.toFixed(0)})`,
            '',
            '🏷️ Top Spending Categories:',
            ...categoryBreakdownLines,
            '',
            '💡 Financial Tip:',
            totalExpense > totalIncome && totalIncome > 0
                ? '• Notice: Your expenses currently exceed your income. Try pausing non-essential online orders.'
                : '• Keep logging every transaction immediately to maintain 100% financial clarity!'
        ].join('\n');
    }

    // 2. Saving Query
    if (isSaveQuery) {
        if (lang === 'Hindi') {
            return [
                '💰 छात्रों के लिए बचत रणनीति 🎯',
                '',
                '• 50/30/20 नियम:',
                '  - 50% आवश्यक खर्चों के लिए (मेस, फीस, यात्रा, कमरा किराया, अध्ययन सामग्री)',
                '  - 30% व्यक्तिगत व मनोरंजन (कैंटीन, वीकेंड आउटिंग, सब्सक्रिप्शन)',
                '  - 20% आपातकालीन बचत (बचत खाते या लिक्विड फंड में रखें)',
                '',
                '• 48-घंटे का नियम: ₹500 से अधिक की किसी भी गैर-जरूरी खरीद के लिए 48 घंटे प्रतीक्षा करें। अधिकांश बार इच्छा अपने आप खत्म हो जाती है!',
                '• छात्र छूट (Student Discounts) का लाभ उठाकर प्रति वर्ष हजारों रुपये बचाएं।'
            ].join('\n');
        }
        if (lang === 'Tamil') {
            return [
                '💰 மாணவர்களுக்கான சேமிப்பு உத்தி 🎯',
                '',
                '• 50/30/20 விதி:',
                '  - 50% அத்தியாவசிய தேவைகளுக்கு (உணவு, கட்டணம், போக்குவரத்து, படிப்பு)',
                '  - 30% பொழுதுபோக்கு மற்றும் விருப்பங்களுக்கு (கேன்டீன், விடுமுறை)',
                '  - 20% அவசரகால சேமிப்பு',
                '',
                '• 48 மணிநேர விதி: ₹500 க்கும் அதிகமான ஆன்லைன் வாங்குதல்களுக்கு 48 மணிநேரம் காத்திருங்கள்.',
                '• மாணவர் தள்ளுபடிகளை முழுமையாகப் பயன்படுத்தி பணத்தை மிச்சப்படுத்துங்கள்.'
            ].join('\n');
        }
        if (lang === 'Kannada') {
            return [
                '💰 ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಉಳಿತಾಯ ತಂತ್ರ 🎯',
                '',
                '• 50/30/20 ನಿಯಮ:',
                '  - 50% ಅಗತ್ಯತೆಗಳಿಗೆ (ಊಟ, ಶುಲ್ಕ, ಪ್ರಯಾಣ, ಪುಸ್ತಕಗಳು)',
                '  - 30% ಮನರಂಜನೆಗೆ (ಕ್ಯಾಂಟೀನ್, ವಾರಾಂತ್ಯ)',
                '  - 20% ತುರ್ತು ಉಳಿತಾಯ',
                '',
                '• 48 ಗಂಟೆಗಳ ನಿಯಮ: ₹500 ಕ್ಕಿಂತ ಹೆಚ್ಚಿನ ಆನ್‌ಲೈನ್ ಖರೀದಿಗೆ 48 ಗಂಟೆ ಕಾಯಿರಿ.',
                '• ವಿದ್ಯಾರ್ಥಿ ರಿಯಾಯಿತಿಗಳನ್ನು ಬಳಸಿಕೊಳ್ಳಿ.'
            ].join('\n');
        }
        if (lang === 'Marathi') {
            return [
                '💰 विद्यार्थ्यांसाठी बचत धोरण 🎯',
                '',
                '• 50/30/20 नियम:',
                '  - 50% अत्यावश्यक गरजांसाठी (मेस, फी, प्रवास, पुस्तके)',
                '  - 30% मौजमजेसाठी (कँटीन, सहल)',
                '  - 20% आणीबाणीच्या बचतीसाठी',
                '',
                '• 48 तासांचा नियम: ₹500 पेक्षा जास्त खरेदीसाठी 48 तास थांबा.',
                '• विद्यार्थी सवलतींचा (Student Discounts) पुरेपूर वापर करा.'
            ].join('\n');
        }
        if (lang === 'Urdu') {
            return [
                '💰 طلبہ کے لیے بچت کی حکمت عملی 🎯',
                '',
                '• 50/30/20 اصول:',
                '  - 50% لازمی ضروریات کے لیے (میس، فیس، کرایہ، کتابیں)',
                '  - 30% تفریح اور مشاغل کے لیے (کینٹین، آؤٹنگ)',
                '  - 20% ہنگامی بچت کے لیے',
                '',
                '• 48 گھنٹے کا اصول: غیر ضروری خریداری سے پہلے 48 گھنٹے انتظار کریں۔',
                '• اسٹوڈنٹ ڈسکاؤنٹس کا فائدہ اٹھا کر رقم بچائیں۔'
            ].join('\n');
        }
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

    // 3. Budget Query
    if (isBudgetQuery) {
        if (lang === 'Hindi') {
            return [
                '📊 छात्रों के लिए 3-चरणीय बजट 📝',
                '',
                '• चरण 1: अपने मासिक भत्ते को 4 बराबर साप्ताहिक हिस्सों में बाँटें।',
                '• चरण 2: महीने की शुरुआत में सबसे पहले आवश्यक खर्च (कमरा किराया, रिचार्ज) अलग रखें।',
                '• चरण 3: इस सप्ताह अधिक खर्च हो तो अगले सप्ताह थोड़ा संयम बरतें।',
                '',
                `• वर्तमान स्थिति: आपने ₹${totalExpense.toFixed(0)} खर्च किए हैं और ₹${balance.toFixed(0)} शेष हैं।`
            ].join('\n');
        }
        if (lang === 'Tamil') {
            return [
                '📊 மாணவர் எளிய 3-படி பட்ஜெட் 📝',
                '',
                '• படி 1: மாதாந்திர பணத்தை 4 சம வாரங்களாக பிரிக்கவும்.',
                '• படி 2: தொடக்கத்திலேயே அத்தியாவசிய செலவுகளை ஒதுக்குங்கள்.',
                '• படி 3: ஒரு வாரத்தில் அதிக செலவானால் அடுத்த வாரம் சிக்கனமாக இருங்கள்.',
                '',
                `• தற்போதைய நிலை: பதிவு செய்த செலவு ₹${totalExpense.toFixed(0)}, மீதமுள்ள தொகை ₹${balance.toFixed(0)}.`
            ].join('\n');
        }
        if (lang === 'Kannada') {
            return [
                '📊 ಸರಳ 3 ಹಂತದ ವಿದ್ಯಾರ್ಥಿ ಬಜೆಟ್ 📝',
                '',
                '• ಹಂತ 1: ಮಾಸಿಕ ಹಣವನ್ನು 4 ಸಮಾನ ವಾರಗಳಾಗಿ ವಿಂಗಡಿಸಿ.',
                '• ಹಂತ 2: ತಿಂಗಳ ಆರಂಭದಲ್ಲೇ ಮುಖ್ಯ ವೆಚ್ಚಗಳನ್ನು ಪಾವತಿಸಿ.',
                '• ಹಂತ 3: ಈ ವಾರ ಹೆಚ್ಚು ಖರ್ಚಾದರೆ ಮುಂದಿನ ವಾರ ಮಿತವಾಗಿರಿ.',
                '',
                `• ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ: ₹${totalExpense.toFixed(0)} ಖರ್ಚಾಗಿದೆ ಮತ್ತು ₹${balance.toFixed(0)} ಬಾಕಿ ಉಳಿದಿದೆ.`
            ].join('\n');
        }
        if (lang === 'Marathi') {
            return [
                '📊 सोपे ३-टप्प्यांचे बजेट 📝',
                '',
                '• टप्पा १: मासिक पॉकेटमनी ४ समान आठवड्यांमध्ये विभागून घ्या.',
                '• टप्पा २: सुरुवातीलाच अत्यावश्यक देणी देऊन टाका.',
                '• टप्पा ३: एका आठवड्यात जास्तीचा खर्च झाल्यास पुढील आठवड्यात हात आवळता घ्या.',
                '',
                `• सध्याची स्थिती: तुम्ही ₹${totalExpense.toFixed(0)} खर्च केले आहेत आणि ₹${balance.toFixed(0)} शिल्लक आहेत.`
            ].join('\n');
        }
        if (lang === 'Urdu') {
            return [
                '📊 طلبہ کے لیے آسان 3 مرحلہ وار بجٹ 📝',
                '',
                '• مرحلہ 1: اپنے ماہانہ اخراجات کو 4 برابر ہفتوں میں تقسیم کریں۔',
                '• مرحلہ 2: مہینے کے آغاز میں لازمی اخراجات الگ کر لیں۔',
                '• مرحلہ 3: ایک ہفتے زیادہ خرچ ہو تو اگلے ہفتے احتیاط برتیں۔',
                '',
                `• موجودہ صورتحال: آپ نے ₹${totalExpense.toFixed(0)} خرچ کیے ہیں اور ₹${balance.toFixed(0)} باقی ہیں۔`
            ].join('\n');
        }
        return [
            '📊 Simple 3-Step Student Budget 📝',
            '',
            '• Step 1: Divide your monthly allowance into 4 equal weekly buckets.',
            '• Step 2: Pay essentials first (recharges, room dues, books) at the start of the month.',
            '• Step 3: Never roll over overspending into the next week—if you spend extra this week, tighten the belt for the remaining days.',
            '',
            `• Current Status: You have logged ₹${totalExpense.toFixed(0)} in expenses with ₹${balance.toFixed(0)} balance remaining.`
        ].join('\n');
    }

    // 4. Food Query
    if (isFoodQuery) {
        if (lang === 'Hindi') {
            return [
                '🍔 समझदारी से खाना और कैंटीन खर्च 💡',
                '',
                '• कैंटीन और डिलीवरी शुल्क छात्रों के बजट को सबसे ज्यादा नुकसान पहुंचाते हैं।',
                '• सुझाव: सोमवार से शुक्रवार मेस या घर का खाना खाएं और केवल वीकेंड पर बाहर जाएं।',
                '• दोस्तों के साथ मिलकर खाना ऑर्डर करें ताकि डिलीवरी शुल्क बंट जाए।',
                '• कमरे में फल, भुने चने या मखाना रखें ताकि रात को बेवजह ऑनलाइन ऑर्डर न करना पड़े।'
            ].join('\n');
        }
        if (lang === 'Tamil') {
            return [
                '🍔 உணவு மற்றும் கேன்டீன் செலவு குறிப்புகள் 💡',
                '',
                '• கேன்டீன் மற்றும் டெலிவரி கட்டணங்கள் பட்ஜெட்டை விரைவாகக் குறைக்கும்.',
                '• திங்கள் முதல் வெள்ளி வரை விடுதி உணவைச் சாப்பிட்டு, வார இறுதியில் மட்டும் வெளியே செல்லவும்.',
                '• டெலிவரி கட்டணத்தை நண்பர்களுடன் பகிர்ந்துகொள்ள ஒன்றாக ஆர்டர் செய்யுங்கள்.',
                '• இரவில் பசி எடுத்தால் சாப்பிட அறையில் எளிய தின்பண்டங்களை வைத்திருங்கள்.'
            ].join('\n');
        }
        if (lang === 'Kannada') {
            return [
                '🍔 ಚುರುಕಾದ ಆಹಾರ ಮತ್ತು ಕ್ಯಾಂಟೀನ್ ಖರ್ಚು 💡',
                '',
                '• ಕ್ಯಾಂಟೀನ್ ಮತ್ತು ಡೆಲಿವರಿ ಶುಲ್ಕಗಳು ಬಜೆಟ್ ಮೇಲೆ ಹೆಚ್ಚು ಪ್ರಭಾವ ಬೀರುತ್ತವೆ.',
                '• ವಾರದ ದಿನಗಳಲ್ಲಿ ಮೆಸ್ ಊಟ ಮಾಡಿ, ವಾರಾಂತ್ಯದಲ್ಲಿ ಮಾತ್ರ ಹೊರಗೆ ಹೋಗಿ.',
                '• ಡೆಲಿವರಿ ಶುಲ್ಕವನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ಸ್ನೇಹಿತರೊಂದಿಗೆ ಜೊತೆಯಾಗಿ ಆರ್ಡರ್ ಮಾಡಿ.',
                '• ರಾತ್ರಿ ಅನಗತ್ಯ ಆರ್ಡರ್ ತಪ್ಪಿಸಲು ಕೋಣೆಯಲ್ಲಿ ಲಘು ಉಪಹಾರಗಳನ್ನು ಇಟ್ಟುಕೊಳ್ಳಿ.'
            ].join('\n');
        }
        if (lang === 'Marathi') {
            return [
                '🍔 अन्न आणि कँटीन खर्च नियोजन 💡',
                '',
                '• कँटीन आणि ऑनलाइन फूड डिलिव्हरीमुळे विद्यार्थ्यांचे बजेट सर्वाधिक बिघडते.',
                '• सोमवार ते शुक्रवार मेसचे जेवण घ्या आणि केवळ वीकेंडला बाहेर जा.',
                '• डिलिव्हरी चार्जेस वाचवण्यासाठी मित्रांसोबत एकत्र ऑर्डर करा.',
                '• रात्रीच्या भुकेसाठी खोलीत चणे किंवा फळे यांसारखे पौष्टिक स्नॅक्स ठेवा.'
            ].join('\n');
        }
        if (lang === 'Urdu') {
            return [
                '🍔 کینٹین اور کھانے کے اخراجات میں بچت 💡',
                '',
                '• کینٹین اور فوڈ ڈیلیوری طلبہ کے بجٹ کو سب سے زیادہ متاثر کرتی ہے۔',
                '• پیر سے جمعہ تک ہاسٹل میس میں کھائیں اور صرف ویک اینڈ پر باہر جائیں۔',
                '• ڈیلیوری چارجز بچانے کے لیے دوستوں کے ساتھ مل کر آرڈر کریں۔',
                '• رات کی ہلکی بھوک کے لیے کمرے میں ہلکے پھلکے اسنیکس رکھیں۔'
            ].join('\n');
        }
        return [
            '🍔 Smarter Food & Canteen Spending 💡',
            '',
            '• Canteen & delivery fees are the #1 budget killer for hostelers and college students.',
            '• Tip: Stick to hostel mess or home-cooked meals Monday through Friday, and treat yourself on weekends.',
            '• Order food together in groups to split delivery charges and use promo coupons.',
            '• Keep basic healthy snacks (peanuts, fruits, makhana) in your room so you do not order food when mildly hungry at night.'
        ].join('\n');
    }

    // 5. Income / Investing Query
    if (isIncomeQuery) {
        if (lang === 'Hindi') {
            return [
                '🚀 छात्रों के लिए आय और निवेश टिप्स 📈',
                '',
                '• कौशल विकास: कॉलेज में सबसे बड़ा निवेश नए कौशल (कोडिंग, डिज़ाइन, राइटिंग) सीखना है।',
                '• फ्रीलांस / इंटर्नशिप: पार्ट-टाइम काम या जूनियर छात्रों को पढ़ाकर पॉकेट मनी कमाएं।',
                '• छोटी बचत: आपातकालीन फंड बनाने के बाद ₹500/माह का इंडेक्स फंड सिप (SIP) शुरू कर सकते हैं।'
            ].join('\n');
        }
        if (lang === 'Tamil') {
            return [
                '🚀 மாணவர் வருமானம் மற்றும் முதலீட்டு குறிப்புகள் 📈',
                '',
                '• திறன் மேம்பாடு: கல்லூரியில் அதிக வருமானம் தரும் முதலீடு புதிய திறன்களைக் கற்றுக்கொள்வதே.',
                '• ஃப்ரீலான்ஸ்: பகுதிநேர வேலைகள் அல்லது பயிற்சி மூலம் வருமானம் ஈட்டுங்கள்.',
                '• சிறு முதலீடு: அவசரகால நிதியை உருவாக்கிய பிறகு சிறிய SIP முதலீட்டைத் தொடங்கலாம்.'
            ].join('\n');
        }
        if (lang === 'Kannada') {
            return [
                '🚀 ಆದಾಯ ಮತ್ತು ಹೂಡಿಕೆ ಸಲಹೆಗಳು 📈',
                '',
                '• ಕೌಶಲ್ಯ ವೃದ್ಧಿ: ಹೊಸ ಕೌಶಲ್ಯಗಳನ್ನು ಕಲಿಯುವುದು ಕಾಲೇಜಿನ ಅತ್ಯುತ್ತಮ ಹೂಡಿಕೆಯಾಗಿದೆ.',
                '• ಫ್ರೀಲ್ಯಾನ್ಸ್: ಪಾರ್ಟ್-ಟೈಮ್ ಗಿಗ್ಸ್ ಅಥವಾ ಟ್ಯೂಷನ್ ಮೂಲಕ ಗಳಿಸಿ.',
                '• ಸಣ್ಣ ಹೂಡಿಕೆ: ₹500/ತಿಂಗಳು SIP ಮೂಲಕ ಹೂಡಿಕೆ ಕಲಿಯಿರಿ.'
            ].join('\n');
        }
        if (lang === 'Marathi') {
            return [
                '🚀 उत्पन्न आणि गुंतवणूक टिप्स 📈',
                '',
                '• कौशल्य विकास: कॉलेजमध्ये नवीन स्किल्स शिकणे ही सर्वात मोठी गुंतवणूक आहे.',
                '• फ्रीलान्सिंग: पार्ट-टाइम काम किंवा शिकवणी घेऊन उत्पन्न वाढवा.',
                '• लहान गुंतवणूक: ₹५००/महिना SIP द्वारे बचतीची सवय लावा.'
            ].join('\n');
        }
        if (lang === 'Urdu') {
            return [
                '🚀 آمدنی اور سرمایہ کاری کے طریقے 📈',
                '',
                '• مہارتوں کا حصول: کالج کے دوران نئی صلاحیتیں سیکھنا سب سے بہترین سرمایہ کاری ہے۔',
                '• فری لانسنگ: پارٹ ٹائم پروجیکٹس اور ٹیوشن سے پاکٹ منی میں اضافہ کریں۔',
                '• چھوٹی سرمایہ کاری: بنیادی بچت کے بعد چھوٹے پیمانے پر ماہانہ بچت کی عادت ڈالیں۔'
            ].join('\n');
        }
        return [
            '🚀 Student Income & Investing Tips 📈',
            '',
            '• Skill Building: The highest ROI investment in college is building in-demand skills (coding, design, writing, video editing).',
            '• Freelance/Internships: Take up part-time campus gigs, tutoring junior students, or freelance projects.',
            '• Micro-Investing: Once you build an emergency fund of ₹3,000 - ₹5,000, consider starting a ₹500/month index fund SIP to learn how compounding works over time.'
        ].join('\n');
    }

    // Default student advisor response
    if (lang === 'Hindi') {
        return [
            '🎓 FinFit छात्र सलाहकार 💬',
            '',
            '• आपके वित्तीय रिकॉर्ड के आधार पर:',
            `  - कुल दर्ज खर्च: ₹${totalExpense.toFixed(0)} (${txList.length} लेनदेन में)`,
            `  - कुल दर्ज आय: ₹${totalIncome.toFixed(0)}`,
            `  - वर्तमान शेष राशि: ₹${balance.toFixed(0)}`,
            '',
            '• मुख्य सिफारिश:',
            '  - वित्तीय स्पष्टता बनाए रखने के लिए भुगतान करते ही हर खर्च को ट्रैक करें।',
            '  - महीने के मध्य में गैर-जरूरी खर्चों को नियंत्रण में रखें।',
            '',
            'आप मुझसे पूछ सकते हैं: "मुझे मेरे खर्चों के बारे में बताएं", "पैसे कैसे बचाएं?", "बजट बनाने में मदद करें", या "खाने का खर्च कैसे कम करें"!'
        ].join('\n');
    }

    if (lang === 'Tamil') {
        return [
            '🎓 FinFit மாணவர் நிதி ஆலோசகர் 💬',
            '',
            '• உங்கள் நிதி பதிவுகளின் அடிப்படையில்:',
            `  - பதிவு செய்யப்பட்ட மொத்த செலவு: ₹${totalExpense.toFixed(0)} (${txList.length} பரிவர்த்தனைகள்)`,
            `  - பதிவு செய்யப்பட்ட மொத்த வருமானம்: ₹${totalIncome.toFixed(0)}`,
            `  - தற்போதைய இருப்பு: ₹${balance.toFixed(0)}`,
            '',
            '• முக்கிய பரிந்துரை:',
            '  - பணம் செலுத்தியவுடன் ஒவ்வொரு செலவையும் உடனடியாகப் பதிவு செய்யுங்கள்.',
            '  - மாத நடுப்பகுதியில் தேவையற்ற செலவுகளைக் கட்டுப்படுத்துங்கள்.',
            '',
            'என்னிடம் கேளுங்கள்: "எனது செலவுகளைப் பற்றி கூறுங்கள்", "பணத்தை எப்படி சேமிப்பது?", "பட்ஜெட் திட்டமிட உதவுங்கள்"!'
        ].join('\n');
    }

    if (lang === 'Kannada') {
        return [
            '🎓 FinFit ವಿದ್ಯಾರ್ಥಿ ಹಣಕಾಸು ಸಲಹೆಗಾರ 💬',
            '',
            '• ನಿಮ್ಮ ಹಣಕಾಸಿನ ದಾಖಲೆಗಳ ಆಧಾರದ ಮೇಲೆ:',
            `  - ಒಟ್ಟು ದಾಖಲಾದ ಖರ್ಚುಗಳು: ₹${totalExpense.toFixed(0)} (${txList.length} ವಹಿವಾಟುಗಳು)`,
            `  - ಒಟ್ಟು ದಾಖಲಾದ ಆದಾಯ: ₹${totalIncome.toFixed(0)}`,
            `  - ಪ್ರಸ್ತುತ ಉಳಿದ ಬಾಕಿ: ₹${balance.toFixed(0)}`,
            '',
            '• ಮುಖ್ಯ ಶಿಫಾರಸು:',
            '  - ಪ್ರತಿ ಖರ್ಚನ್ನು ತಕ್ಷಣವೇ ನಮೂದಿಸಿ ಸ್ಪಷ್ಟತೆ ಕಾಪಾಡಿಕೊಳ್ಳಿ.',
            '  - ತಿಂಗಳ ಮಧ್ಯದಲ್ಲಿ ಅನಗತ್ಯ ವೆಚ್ಚಗಳನ್ನು ನಿಯಂತ್ರಿಸಿ.',
            '',
            'ನನ್ನನ್ನು ಕೇಳಿ: "ನನ್ನ ಖರ್ಚುಗಳ ಬಗ್ಗೆ ತಿಳಿಸಿ", "ಹಣ ಉಳಿಸುವುದು ಹೇಗೆ?", "ಬಜೆಟ್ ಮಾಡಲು ಸಹಾಯ ಮಾಡಿ"!'
        ].join('\n');
    }

    if (lang === 'Marathi') {
        return [
            '🎓 FinFit विद्यार्थी आर्थिक सल्लागार 💬',
            '',
            '• तुमच्या आर्थिक नोंदींवर आधारित:',
            `  - एकूण नोंदवलेला खर्च: ₹${totalExpense.toFixed(0)} (${txList.length} व्यवहारांमध्ये)`,
            `  - एकूण नोंदवलेले उत्पन्न: ₹${totalIncome.toFixed(0)}`,
            `  - सध्याची शिल्लक: ₹${balance.toFixed(0)}`,
            '',
            '• मुख्य शिफारस:',
            '  - अचूक आर्थिक नियोजनासाठी पैसे खर्च करताच नोंद करा.',
            '  - महिन्याच्या मध्यावर अनावश्यक खर्चावर नियंत्रण ठेवा.',
            '',
            'तुम्ही मला विचारू शकता: "मला माझ्या खर्चाबद्दल सांगा", "पैसे कसे वाचवायचे?", "बजेट बनवण्यात मदत करा"!'
        ].join('\n');
    }

    if (lang === 'Urdu') {
        return [
            '🎓 FinFit طلبہ مالی مشیر 💬',
            '',
            '• آپ کے مالیاتی ریکارڈ کی بنیاد پر:',
            `  - کل درج شدہ اخراجات: ₹${totalExpense.toFixed(0)} (${txList.length} لین دین میں)`,
            `  - کل درج شدہ آمدنی: ₹${totalIncome.toFixed(0)}`,
            `  - موجودہ دستیاب رقم: ₹${balance.toFixed(0)}`,
            '',
            '• بنیادی مشورہ:',
            '  - مالی شفافیت کے لیے ہر خرچ فوری ریکارڈ کریں۔',
            '  - مہینے کے وسط میں غیر ضروری اخراجات پر قابو پائیں۔',
            '',
            'بلا جھجھک پوچھیں: "مجھے اپنے اخراجات کے بارے میں بتائیں", "پیسے کیسے بچائے جائیں؟", "بجٹ بنانے میں مدد کریں"!'
        ].join('\n');
    }

    return [
        '🎓 FinFit Student Advisor 💬',
        '',
        '• Based on your financial records:',
        `  - Total Logged Expenses: ₹${totalExpense.toFixed(0)} across ${txList.length} transactions`,
        `  - Total Logged Income: ₹${totalIncome.toFixed(0)}`,
        `  - Current Balance: ₹${balance.toFixed(0)}`,
        '',
        '• Top Recommendation:',
        '  - Track every expense right when you pay to maintain clear financial vision.',
        '  - Keep discretionary spends under control during the middle of the month.',
        '',
        'Feel free to ask me: "Tell me about my expenses", "How to save money?", "Help me budget for this week", or "How to cut food expenses"!'
    ].join('\n');
}

const getInitialAnalysis = async (summary, transactions, language = 'English') => {
    const lang = normalizeLang(language);
    const data = normalizeFinancialData(summary, transactions);
    const summaryContext = {
        totalExpense: data.totalExpense,
        totalIncome: data.totalIncome,
        balance: data.balance,
        transactionCount: data.txList.length,
        categoryBreakdown: data.catTotals
    };

    const languageDirective = (lang !== 'English')
        ? `CRITICAL REQUIREMENT: You MUST write your ENTIRE response in ${lang}. Do NOT reply in English. Use natural, student-friendly ${lang} with pointers and emojis.`
        : `Respond in clear English suitable for Indian college students.`;

    const analysisPrompt = `As a financial advisor for Indian college students, analyze this financial data and provide a brief assessment. ${languageDirective}
Use bullet points (•) and emojis to make it easy to read:

Summary: ${JSON.stringify(summaryContext)}
Recent Transactions: ${JSON.stringify(data.txList.slice(0, 15))}

Provide a concise analysis covering:
1. Overall spending patterns 💸
2. Key areas of concern ⚠️
3. Positive financial habits 🌟
4. One specific actionable suggestion 💡

Keep it friendly and focused on the student context.`;

    try {
        const text = await runAiChat([
            { role: 'system', content: `You are a concise, friendly financial advisor for Indian college students. ${languageDirective} Use bullet points (•) and emojis. IMPORTANT: Do NOT use any markdown formatting. No asterisks (*), no bold (**), no italic (*). Use plain text only.` },
            { role: 'user', content: analysisPrompt }
        ], { temperature: 0.4 });

        if (text) {
            return formatWithLineBreaks(text);
        }
    } catch (error) {
        console.warn('AI analysis notice (activating smart advisor engine):', error?.message);
    }

    // High quality student financial analysis based on user data and language
    return generateLocalStudentAnalysis(summary, transactions, lang);
};

const chatWithAI = async (message, summary, transactions, language = 'English') => {
    const lang = normalizeLang(language);
    const data = normalizeFinancialData(summary, transactions);
    const summaryContext = {
        totalExpense: data.totalExpense,
        totalIncome: data.totalIncome,
        balance: data.balance,
        transactionCount: data.txList.length,
        categoryBreakdown: data.catTotals
    };

    const languageDirective = (lang !== 'English')
        ? `CRITICAL REQUIREMENT: You MUST write your ENTIRE response in ${lang}. Do NOT reply in English. Use natural, student-friendly ${lang} with pointers and emojis.`
        : `Respond in clear English suitable for Indian college students.`;

    const contextPrompt = `You are a financial advisor for Indian college students. Here is the current financial context. ${languageDirective}
Respond using pointers and emojis for clarity:

Summary: ${JSON.stringify(summaryContext)}
Recent Transactions: ${JSON.stringify(data.txList.slice(0, 20))}

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
            { role: 'system', content: `You are a helpful financial advisor for Indian college students. ${languageDirective} Use bullet points (•) and emojis. IMPORTANT: Do NOT use any markdown formatting. No asterisks (*), no bold (**), no italic (*). Use plain text only.` },
            { role: 'user', content: contextPrompt }
        ], { temperature: 0.5 });

        if (text) {
            return formatWithLineBreaks(text);
        }
    } catch (error) {
        console.warn('AI chat notice (activating smart advisor engine):', error?.message);
    }

    // High quality student chat response based on user message, data, and language
    return generateLocalChatResponse(message, summary, transactions, lang);
};

export { chatWithAI, getInitialAnalysis };
export default { chatWithAI, getInitialAnalysis };
