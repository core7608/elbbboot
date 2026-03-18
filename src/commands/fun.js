// src/commands/fun.js - أوامر الترفيه والمرح (10+ أوامر)

const { askGemini } = require('../features/gemini');

async function handle(ctx) {
    const { command, sock, jid, msg, reply, sender, senderId, args, text, mentionedJid } = ctx;

    // ─── 1. بحبك ❤️ (الأمر الخاص) ───
    if (['بحبك', 'love', 'احبك'].includes(command)) {
        const target = mentionedJid[0];
        const targetId = target ? target.split('@')[0] : null;
        
        // تصميم جميل بالنص
        const loveDesign = `
❤️✨━━━━━━━━━━━━━━━━━━━━━━✨❤️

     💌  I  L O V E  Y O U  💌

${targetId ? `💝 من: @${senderId}
💖 إلى: @${targetId}` : `💝 يحبك: @${senderId}`}

    ❤️‍🔥 *حبٌّ من القلب لا حدود له* ❤️‍🔥

❤️✨━━━━━━━━━━━━━━━━━━━━━━✨❤️
         🌹 للأبد وأكثر 🌹
❤️✨━━━━━━━━━━━━━━━━━━━━━━✨❤️`.trim();

        const mentions = [sender];
        if (target) mentions.push(target);

        await sock.sendMessage(jid, { text: loveDesign, mentions }, { quoted: msg });
        return true;
    }

    // ─── 2. مزاج ───
    if (['مزاج', 'mood', 'حالتي'].includes(command)) {
        const moods = [
            "😊 عظيم! يوم رائع في الطريق!",
            "😎 رائع! الطاقة بالذروة!",
            "🤔 مقبول... بحاجة لقهوة ☕",
            "😴 نعسان... الوسادة تناديني!",
            "🔥 متحمس! جاهز لأي شيء!",
            "😅 عادي... يوم من الأيام",
        ];
        const mood = moods[Math.floor(Math.random() * moods.length)];
        await reply(`💭 *مزاجك اليوم:*\n\n${mood}`);
        return true;
    }

    // ─── 3. رأيك في شخص ───
    if (['رأيي', 'rate', 'قيّم'].includes(command)) {
        const target = mentionedJid[0] || sender;
        const qualities = [
            "ذكي جداً 🧠", "محبوب 💖", "مضحك 😂", "جاد ومجتهد 💪",
            "كريم ومعطاء 🎁", "حكيم 🦉", "شخصية قيادية 👑", "مرح وخفيف 🎉"
        ];
        const random = qualities[Math.floor(Math.random() * qualities.length)];
        const score = Math.floor(Math.random() * 30) + 70; // بين 70-100
        
        await sock.sendMessage(jid, {
            text: `⭐ *تقييم @${target.split('@')[0]}:*\n\n✨ ${random}\n📊 التقييم: ${score}/100\n\n💬 البوت يقول: شخص رائع!`,
            mentions: [target]
        }, { quoted: msg });
        return true;
    }

    // ─── 4. برج ───
    if (['برج', 'horoscope', 'فأل'].includes(command)) {
        const zodiac = text || 'الحمل';
        const reading = await askGemini(`اكتب توقع يومي خفيف وإيجابي لبرج ${zodiac} (3 أسطر فقط)`);
        await reply(`⭐ *برج ${zodiac} اليوم:*\n\n${reading}`);
        return true;
    }

    // ─── 5. لعبة أرقام ───
    if (['خمن_رقم', 'guess_number'].includes(command)) {
        const secret = Math.floor(Math.random() * 100) + 1;
        await reply(`🎯 *لعبة تخمين الرقم!*\n\nفكرت برقم من 1 إلى 100\n\nاستخدم *.تخمين [رقم]* للتخمين!\n\n🔑 (للأدمن فقط - الجواب: ${secret})`);
        return true;
    }

    // ─── 6. صناعة اسم ───
    if (['اسمي', 'my_name', 'معنى_اسمي'].includes(command)) {
        const name = text || senderId;
        const meaning = await askGemini(`ما معنى اسم "${name}" وأصله؟ بشكل مختصر وجميل`);
        await reply(`📛 *اسم ${name}:*\n\n${meaning}`);
        return true;
    }

    // ─── 7. أغنية ───
    if (['اغنية', 'song', 'أنشودة'].includes(command)) {
        const mood = text || 'حماسية';
        const suggestion = await askGemini(`اقترح أغنية عربية ${mood} مشهورة مع اسم المغني (واحدة فقط)`);
        await reply(`🎵 *اقتراح أغنية ${mood}:*\n\n${suggestion}`);
        return true;
    }

    // ─── 8. لون شخصيتك ───
    if (['لوني', 'color', 'لون_شخصيتك'].includes(command)) {
        const colors = [
            { color: "🔴 أحمر", desc: "شخصية قوية وعاطفية" },
            { color: "🔵 أزرق", desc: "هادئ ومتزن وعميق" },
            { color: "🟡 أصفر", desc: "مرح ومتفائل ومبدع" },
            { color: "🟢 أخضر", desc: "طبيعي وهادئ ومحب" },
            { color: "🟣 بنفسجي", desc: "غامض وفني وذكي" },
            { color: "🟠 برتقالي", desc: "اجتماعي ونشيط ومتحمس" },
        ];
        const c = colors[Math.floor(Math.random() * colors.length)];
        await reply(`🎨 *لون شخصيتك:*\n\n${c.color}\n💭 ${c.desc}`);
        return true;
    }

    // ─── 9. توليد قصة قصيرة ───
    if (['قصة', 'story'].includes(command)) {
        const genre = text || 'مغامرة';
        await sock.sendMessage(jid, { react: { text: "📖", key: msg.key } });
        const story = await askGemini(`اكتب قصة قصيرة جداً (فقرة واحدة) من نوع ${genre}`);
        await reply(`📖 *قصة ${genre}:*\n\n${story}`);
        return true;
    }

    // ─── 10. تحدي ───
    if (['تحدي', 'challenge', 'تحديات'].includes(command)) {
        const challenges = [
            "🏃 افعل 20 ضغطة الآن وأثبت!",
            "🧠 احفظ سورة جديدة اليوم!",
            "📚 اقرأ 10 صفحات من كتاب!",
            "🤝 تواصل مع صديق لم تكلمه منذ فترة!",
            "💧 اشرب 8 أكواب ماء اليوم!",
            "😊 ابتسم لـ 10 أشخاص مختلفين!",
            "📱 ابتعد عن الهاتف لساعة كاملة!",
        ];
        const challenge = challenges[Math.floor(Math.random() * challenges.length)];
        await reply(`💪 *تحدي اليوم:*\n\n${challenge}\n\nهل أنت مستعد؟ 🔥`);
        return true;
    }

    // ─── 11. اقتراح فيلم ───
    if (['فيلم', 'movie', 'افلام'].includes(command)) {
        const genre = text || 'أكشن';
        const movie = await askGemini(`اقترح فيلم ${genre} رائع مع وصف مختصر لـ 2 سطر`);
        await reply(`🎬 *اقتراح فيلم ${genre}:*\n\n${movie}`);
        return true;
    }

    // ─── 12. أسئلة سريعة ───
    if (['سريع', 'rapid', 'هجوم'].includes(command)) {
        const questions = [
            "🔴 أحمر أم أزرق؟",
            "☕ قهوة أم شاي؟",
            "🌙 ليل أم نهار؟",
            "🏖️ بحر أم جبل؟",
            "🎮 ألعاب أم كتب؟",
            "🍕 بيتزا أم برغر؟",
        ];
        const q = questions[Math.floor(Math.random() * questions.length)];
        await reply(`⚡ *سؤال سريع:*\n\n${q}\n\nردّ بسرعة! ⏱️`);
        return true;
    }

    return false;
}

module.exports = { handle };
