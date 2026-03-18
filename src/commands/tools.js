// src/commands/tools.js - أدوات ومساعدات (35 أمر)

const axios = require('axios');
const sharp = require('sharp');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { askGemini } = require('../features/gemini');
const { getUser, getLeaderboard, addXP } = require('../database');
const config = require('../config');

async function streamToBuffer(stream) {
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

function getStickerSource(ctx) {
    const currentImage = ctx.messageContent?.imageMessage;
    const quotedImage = ctx.quoted?.imageMessage || ctx.contextInfo?.quotedMessage?.imageMessage;

    if (currentImage) {
        return currentImage;
    }

    if (quotedImage) {
        return quotedImage;
    }

    return null;
}

async function handle(ctx) {
    const { command, sock, jid, msg, reply, sender, senderId, isOwner, args, text, mentionedJid } = ctx;

    // ─── 1. أوامر الذكاء الاصطناعي ───
    if (['سؤال', 'ai', 'جيميني', 'اسأل'].includes(command)) {
        if (!text) return reply("❓ اكتب سؤالك بعد الأمر.\nمثال: .سؤال ما هي عاصمة مصر؟") && true;

        try {
            await reply("⏳ جاري معالجة السؤال...");
            await sock.sendMessage(jid, { react: { text: "🔍", key: msg.key } });
            const answer = await askGemini(text);
            await reply(`🤖 *Gemini AI:*\n\n${answer}`);
        } catch (e) {
            await reply(`❌ تعذر تنفيذ أمر الذكاء الاصطناعي: ${e.message}`);
        }
        return true;
    }

    // ─── 2. ترجمة ───
    if (['ترجمة', 'translate', 'ترجم'].includes(command)) {
        if (!text) return reply("📌 مثال: .ترجمة en مرحباً\nاللغات: en ar fr de es it") && true;
        
        const langMatch = text.match(/^([a-z]{2})\s+(.*)/s);
        const targetLang = langMatch ? langMatch[1] : 'en';
        const textToTranslate = langMatch ? langMatch[2] : text;

        try {
            const prompt = `ترجم النص التالي إلى لغة "${targetLang}" فقط بدون أي شرح إضافي:\n\n${textToTranslate}`;
            const translated = await askGemini(prompt);
            await reply(`🌐 *الترجمة (${targetLang}):*\n\n${translated.trim()}`);
        } catch (e) {
            await reply("❌ فشل في الترجمة.");
        }
        return true;
    }

    // ─── 3. تلخيص نص ───
    if (['تلخيص', 'summarize', 'خلاصة'].includes(command)) {
        if (!text) return reply("📌 اكتب النص بعد الأمر: .تلخيص [نص طويل]") && true;
        await sock.sendMessage(jid, { react: { text: "📝", key: msg.key } });
        const summary = await askGemini(`لخص النص التالي بشكل مختصر وواضح:\n\n${text}`);
        await reply(`📋 *التلخيص:*\n\n${summary}`);
        return true;
    }

    // ─── 4. تحسين نص ───
    if (['تحسين', 'improve', 'اصلح'].includes(command)) {
        if (!text) return reply("📌 اكتب النص بعد الأمر.") && true;
        const improved = await askGemini(`حسّن النص التالي لغوياً وأسلوبياً:\n\n${text}`);
        await reply(`✨ *النص المحسّن:*\n\n${improved}`);
        return true;
    }

    // ─── 5. الطقس ───
    if (['طقس', 'weather'].includes(command)) {
        const city = text || 'القاهرة';
        try {
            const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=3&lang=ar`, { timeout: 10000 });
            await reply(`🌤️ *الطقس في ${city}:*\n\n${res.data}`);
        } catch (e) {
            await reply(`❌ لم أستطع جلب بيانات الطقس لـ ${city}`);
        }
        return true;
    }

    // ─── 6. سعر العملة ───
    if (['عملة', 'currency', 'سعر_عملة'].includes(command)) {
        const query = text || 'USD to EGP';
        const info = await askGemini(`أخبرني بالسعر التقريبي الحالي لـ ${query} بشكل مختصر`);
        await reply(`💰 *أسعار العملات:*\n\n${info}`);
        return true;
    }

    // ─── 7. البروفايل (نقاطي) ───
    if (['نقاطي', 'profile', 'بروفايل', 'مستواي'].includes(command)) {
        const target = mentionedJid[0] || sender;
        const user = getUser(target);
        const targetId = target.split('@')[0];
        const nextLevelXP = user.level * 100;
        const progress = Math.min(Math.floor((user.xp / nextLevelXP) * 20), 20);
        const bar = '█'.repeat(progress) + '░'.repeat(20 - progress);
        
        await reply(`
👤 *بروفايل @${targetId}*

🏆 المستوى: ${user.level}
⭐ XP: ${user.xp}/${nextLevelXP}
[${bar}]
📊 عدد الرسائل: ${user.messages}
💎 النقاط: ${user.points}
        `.trim(), { mentions: [target] });
        return true;
    }

    // ─── 8. ليدربورد ───
    if (['ليدربورد', 'leaderboard', 'ترتيب'].includes(command)) {
        const top = getLeaderboard(jid);
        if (!top.length) return reply("📊 لا توجد بيانات بعد.") && true;

        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const list = top.map((u, i) => `${medals[i]} @${u.id} - مستوى ${u.level} (${u.xp} XP)`).join('\n');
        
        await sock.sendMessage(jid, {
            text: `🏆 *قائمة الأقوى:*\n\n${list}`,
            mentions: top.map(u => `${u.id}@s.whatsapp.net`)
        }, { quoted: msg });
        return true;
    }

    // ─── 9. ملصق (Sticker) ───
    if (['ملصق', 'sticker', 'ستيكر'].includes(command)) {
        const sourceImage = getStickerSource(ctx);

        if (!sourceImage) {
            return reply("📌 رد على صورة أو أرسل صورة مع الأمر لتحويلها لملصق.") && true;
        }

        try {
            const stream = await downloadContentFromMessage(sourceImage, 'image');
            const imageBuffer = await streamToBuffer(stream);
            const stickerBuffer = await sharp(imageBuffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 80 })
                .toBuffer();

            await sock.sendMessage(
                jid,
                {
                    sticker: stickerBuffer,
                    mimetype: 'image/webp'
                },
                { quoted: msg }
            );
        } catch (e) {
            await reply(`❌ فشل في إنشاء الملصق: ${e.message}`);
        }
        return true;
    }

    // ─── 10. معلومات ───
    if (['معلومة', 'fact', 'اعرف'].includes(command)) {
        const topic = text || 'عشوائي';
        const fact = await askGemini(`أخبرني بمعلومة مثيرة للاهتمام عن: ${topic} (جملة واحدة فقط)`);
        await reply(`💡 *معلومة:*\n\n${fact}`);
        return true;
    }

    // ─── 11. توليد أسماء ───
    if (['اسم', 'name_gen', 'سمّي'].includes(command)) {
        const type = text || 'عربي';
        const names = await askGemini(`اقترح 5 أسماء ${type} جميلة مع معانيها بشكل مختصر`);
        await reply(`📛 *اقتراحات أسماء ${type}:*\n\n${names}`);
        return true;
    }

    // ─── 12. حساب ───
    if (['حساب', 'calc', 'calculate'].includes(command)) {
        if (!text) return reply("📌 مثال: .حساب 25 * 4 + 10") && true;
        try {
            // حماية: نتحقق أن النص حسابي فقط
            const safeText = text.replace(/[^0-9+\-*/.() ]/g, '');
            const result = eval(safeText);
            await reply(`🔢 *الحساب:*\n${safeText} = *${result}*`);
        } catch (e) {
            await reply("❌ معادلة خاطئة!");
        }
        return true;
    }

    // ─── 13. شعر عربي ───
    if (['شعر', 'poem', 'قصيدة'].includes(command)) {
        const about = text || 'الوطن';
        const poem = await askGemini(`اكتب بيتين من الشعر العربي الفصيح عن: ${about}`);
        await reply(`📜 *شعر عن ${about}:*\n\n${poem}`);
        return true;
    }

    // ─── 14. نكتة ───
    if (['نكتة', 'joke', 'ضحك'].includes(command)) {
        const joke = await askGemini('اكتب نكتة عربية خفيفة ومضحكة وغير مسيئة');
        await reply(`😂 *نكتة:*\n\n${joke}`);
        return true;
    }

    // ─── 15. مجاملة ───
    if (['مجاملة', 'compliment'].includes(command)) {
        const target = mentionedJid[0];
        const comp = await askGemini('اكتب مجاملة عربية رقيقة ولطيفة (جملة واحدة)');
        if (target) {
            await sock.sendMessage(jid, {
                text: `💝 @${target.split('@')[0]}, ${comp}`,
                mentions: [target]
            }, { quoted: msg });
        } else {
            await reply(`💝 ${comp}`);
        }
        return true;
    }

    // ─── 16. تاريخ اليوم ───
    if (['تاريخ', 'date', 'اليوم'].includes(command)) {
        const now = new Date();
        const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
        const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
        
        await reply(`
📅 *التاريخ الحالي:*

📆 ${days[now.getDay()]}، ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}
⏰ الوقت: ${now.toLocaleTimeString('ar')}
        `.trim());
        return true;
    }

    // ─── 17. تنبيه مؤقت ───
    if (['منبه', 'reminder', 'ذكرني'].includes(command)) {
        const timeMatch = text.match(/(\d+)\s*(دقيقة|ساعة|ثانية)/);
        if (!timeMatch) return reply("📌 مثال: .منبه 5 دقيقة أخذ دواء") && true;

        const amount = parseInt(timeMatch[1]);
        const unit = timeMatch[2];
        let ms = amount * (unit === 'ثانية' ? 1000 : unit === 'دقيقة' ? 60000 : 3600000);
        const reminder = text.replace(timeMatch[0], '').trim() || 'موعدك!';

        await reply(`⏰ سيتم تذكيرك بـ *${reminder}* بعد ${amount} ${unit}!`);
        
        setTimeout(async () => {
            await sock.sendMessage(jid, {
                text: `🔔 *التذكير!*\n\n@${senderId}: ${reminder}`,
                mentions: [sender]
            });
        }, ms);
        return true;
    }

    // ─── 18. توليد كلمة مرور ───
    if (['كلمة_مرور', 'password', 'باسورد'].includes(command)) {
        const length = parseInt(args[0]) || 12;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < Math.min(length, 32); i++) {
            password += chars[Math.floor(Math.random() * chars.length)];
        }
        await reply(`🔐 *كلمة مرور عشوائية (${length} حرف):*\n\n\`${password}\`\n\n⚠️ لا تشارك هذه الكلمة مع أحد!`);
        return true;
    }

    // ─── 19. فحص رابط ───
    if (['فحص_رابط', 'checklink'].includes(command)) {
        if (!text) return reply("📌 ضع الرابط بعد الأمر.") && true;
        const analysis = await askGemini(`هل هذا الرابط آمن أم مشبوه؟ ${text}\nأجب بشكل مختصر.`);
        await reply(`🔍 *تحليل الرابط:*\n${text}\n\n${analysis}`);
        return true;
    }

    // ─── 20. وصفة طبخ ───
    if (['وصفة', 'recipe'].includes(command)) {
        if (!text) return reply("📌 مثال: .وصفة كباب") && true;
        await sock.sendMessage(jid, { react: { text: "👨‍🍳", key: msg.key } });
        const recipe = await askGemini(`اكتب وصفة ${text} بشكل مختصر مع المكونات وطريقة التحضير`);
        await reply(`👨‍🍳 *وصفة ${text}:*\n\n${recipe}`);
        return true;
    }

    // ─── 21. نصيحة ───
    if (['نصيحة', 'advice'].includes(command)) {
        const topic = text || 'الحياة';
        const advice = await askGemini(`أعطني نصيحة حياتية قيّمة عن ${topic} بأسلوب بسيط ومؤثر`);
        await reply(`💭 *نصيحة:*\n\n${advice}`);
        return true;
    }

    // ─── 22. تفسير حلم ───
    if (['حلم', 'dream', 'فسّر'].includes(command)) {
        if (!text) return reply("📌 اكتب حلمك: .حلم رأيت...") && true;
        const interpretation = await askGemini(`فسّر هذا الحلم تفسيراً رمزياً مختصراً: ${text}`);
        await reply(`🌙 *تفسير الحلم:*\n\n${interpretation}`);
        return true;
    }

    // ─── 23. اقتباس ───
    if (['اقتباس', 'quote', 'حكمة'].includes(command)) {
        const lang = args[0] || 'عربي';
        const quote = await askGemini(`اكتب اقتباساً ${lang} ملهماً مع ذكر قائله`);
        await reply(`✨ *اقتباس:*\n\n${quote}`);
        return true;
    }

    // ─── 24. تحليل شخصية ───
    if (['تحليل', 'analyze', 'شخصية'].includes(command)) {
        if (!text) return reply("📌 اكتب اسمك أو صف نفسك: .تحليل [وصف]") && true;
        const analysis = await askGemini(`حلّل شخصية شخص بهذا الوصف باختصار وبشكل إيجابي: ${text}`);
        await reply(`🧠 *التحليل:*\n\n${analysis}`);
        return true;
    }

    // ─── 25. ابتكار اسم شركة ───
    if (['اسم_شركة', 'brandname'].includes(command)) {
        if (!text) return reply("📌 صف مجال شركتك: .اسم_شركة [المجال]") && true;
        const names = await askGemini(`اقترح 5 أسماء تجارية مبتكرة لشركة في مجال: ${text}`);
        await reply(`🏢 *اقتراحات اسم الشركة:*\n\n${names}`);
        return true;
    }

    // ─── 26. تحويل أوزان ───
    if (['وزن', 'weight_convert'].includes(command)) {
        if (!text) return reply("📌 مثال: .وزن 70 kg to lbs") && true;
        const result = await askGemini(`حوّل: ${text} وأعطني الرقم فقط مع الوحدة`);
        await reply(`⚖️ *تحويل الوزن:*\n${text} = ${result}`);
        return true;
    }

    // ─── 27. تحويل طول ───
    if (['طول', 'length_convert'].includes(command)) {
        if (!text) return reply("📌 مثال: .طول 5 feet to cm") && true;
        const result = await askGemini(`حوّل: ${text} وأعطني النتيجة فقط`);
        await reply(`📏 *تحويل الطول:*\n${text} = ${result}`);
        return true;
    }

    // ─── 28. اختصار اسم ───
    if (['اختصار', 'abbreviation'].includes(command)) {
        if (!text) return reply("📌 مثال: .اختصار NASA") && true;
        const meaning = await askGemini(`ما معنى اختصار: ${text}؟ باختصار`);
        await reply(`📌 *${text}:*\n${meaning}`);
        return true;
    }

    // ─── 29. إحصائيات المجموعة ───
    if (['احصاء', 'stats'].includes(command)) {
        if (!ctx.isGroup) return reply("⚠️ للمجموعات فقط.") && true;
        const groupMeta = await sock.groupMetadata(jid);
        await reply(`
📊 *إحصائيات المجموعة*

👥 الأعضاء: ${groupMeta.participants.length}
👑 الأدمنية: ${groupMeta.participants.filter(p => p.admin).length}
📅 تاريخ الإنشاء: ${new Date(groupMeta.creation * 1000).toLocaleDateString('ar')}
        `.trim());
        return true;
    }

    // ─── 30. مساعدة الأوامر ───
    if (command === 'tool_help' || command === 'ادوات') {
        await reply(`
🛠️ *أدوات ومساعدات:*

🤖 *.سؤال [نص]* - سؤال لـ Gemini AI
🌐 *.ترجمة [لغة] [نص]* - ترجمة النصوص
📋 *.تلخيص [نص]* - تلخيص النصوص
☀️ *.طقس [مدينة]* - حالة الطقس
📊 *.نقاطي* - بروفايلك ومستواك
🏆 *.ليدربورد* - أقوى اللاعبين
🔐 *.كلمة_مرور [عدد]* - توليد كلمة مرور
⏰ *.منبه [وقت]* - تذكير مؤقت
🔢 *.حساب [معادلة]* - آلة حاسبة
👨‍🍳 *.وصفة [طبق]* - وصفة طبخ
        `.trim());
        return true;
    }

    return false;
}

module.exports = { handle };
