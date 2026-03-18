const config = require('../config');

let modelInstance = null;
const GEMINI_TIMEOUT_MS = 20000;

function withTimeout(promise, timeoutMs = GEMINI_TIMEOUT_MS) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
        })
    ]);
}

function getGeminiModel() {
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        throw new Error('GEMINI_API_KEY_NOT_SET');
    }

    if (!modelInstance) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
        modelInstance = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
    }

    return modelInstance;
}

function mapGeminiError(error) {
    const message = error?.message || String(error);

    if (message === 'GEMINI_TIMEOUT') {
        return '⏳ Gemini تأخر في الرد. جرّب مرة أخرى.';
    }

    if (message.includes('API key') || message.includes('API_KEY')) {
        return '❌ مفتاح Gemini API غير صحيح أو غير مفعّل.';
    }

    if (message.toLowerCase().includes('quota')) {
        return '⚠️ تم تجاوز حد استخدام Gemini.';
    }

    if (message.includes('503') || message.toLowerCase().includes('unavailable')) {
        return '⚠️ خدمة Gemini غير متاحة حاليًا، جرّب مرة أخرى بعد قليل.';
    }

    return `❌ خطأ في Gemini: ${message}`;
}

async function askGemini(prompt, context = '') {
    try {
        const model = getGeminiModel();
        const fullPrompt = context ? `${context}\n\nالسؤال: ${prompt}` : prompt;
        const result = await withTimeout(model.generateContent(fullPrompt));
        const text = result?.response?.text?.();
        return text?.trim() || '⚠️ لم يرجع Gemini نصًا قابلًا للعرض.';
    } catch (error) {
        if (error.message === 'GEMINI_API_KEY_NOT_SET') {
            return '❌ مفتاح Gemini API غير مضبوط في ملف .env';
        }

        console.error('Gemini Error:', error);
        return mapGeminiError(error);
    }
}

async function chatWithContext(messages) {
    try {
        const model = getGeminiModel();
        const chat = model.startChat({ history: messages.slice(0, -1) });
        const lastMsg = messages[messages.length - 1];
        const result = await withTimeout(chat.sendMessage(lastMsg.parts[0].text));
        const text = result?.response?.text?.();
        return text?.trim() || '⚠️ لم يرجع Gemini ردًا.';
    } catch (error) {
        if (error.message === 'GEMINI_API_KEY_NOT_SET') {
            return '❌ مفتاح Gemini API غير مضبوط في ملف .env';
        }

        console.error('Gemini Chat Error:', error);
        return mapGeminiError(error);
    }
}

module.exports = { askGemini, chatWithContext };
