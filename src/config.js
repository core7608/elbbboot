// src/config.js - الإعدادات المركزية للبوت

module.exports = {
    // معلومات البوت
    BOT_NAME: process.env.BOT_NAME || 'ElAawady Bot 🤖',
    PREFIX: process.env.PREFIX || '.',
    
    // أرقام الأدمنية (الأوناز) - بدون + أو @s.whatsapp.net
    OWNERS: (process.env.OWNERS || '966573192557,201226598765').split(',').map(n => n.trim()),
    
    // مفاتيح API
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    
    // ردود فعل الأدمنية
    OWNER_REACTIONS: ['🔥', '🫡', '👑', '💎', '⚡'],
    
    // ألوان وتنسيق
    THEME: {
        primary: '👑',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        loading: '⏳',
    }
};
