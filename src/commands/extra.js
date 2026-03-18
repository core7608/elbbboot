// src/commands/extra.js — 100 أمر إضافي
// الفئات: ترفيه • أدوات • صحة • معرفة • مساعد يومي • جروب • كتابة • ألعاب نصية • تكنولوجيا • متنوع
'use strict';

const axios = require('axios');
const { askGemini } = require('../features/gemini');
const { getUser, db, saveDB } = require('../database');

// ══ مساعدات محلية ══
const MORSE_MAP = {
    A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',
    I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',
    Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',
    Y:'-.--',Z:'--..',0:'-----',1:'.----',2:'..---',3:'...--',4:'....-',
    5:'.....',6:'-....',7:'--...',8:'---..',9:'----.',' ':'/',
};
const toMorse   = t => t.toUpperCase().split('').map(c => MORSE_MAP[c] || c).join(' ');
const toLeet    = t => t.toLowerCase().replace(/[aeiostbgl]/g, c =>
    ({a:'4',e:'3',i:'1',o:'0',s:'5',t:'7',b:'8',g:'9',l:'1'})[c]);
const toRoman   = n => {
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
    let r = ''; vals.forEach((v,i)=>{while(n>=v){r+=syms[i];n-=v;}}); return r;
};
const isPrime   = n => { if(n<2)return false; for(let i=2;i<=Math.sqrt(n);i++)if(n%i===0)return false; return true; };
const randomInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const bar       = (score, max=10) => '█'.repeat(Math.round(score/max))+'░'.repeat(max-Math.round(score/max));

// ══ بيانات محلية ══
const PROVERBS = [
    { p:'العقل زينة',                 e:'العقل هو أجمل ما يتزيَّن به الإنسان.' },
    { p:'الصبر مفتاح الفرج',           e:'من صبر نال ما يريد في النهاية.' },
    { p:'من جدَّ وجد ومن زرع حصد',    e:'العمل الجاد يُثمر دائماً.' },
    { p:'الوقت كالسيف إن لم تقطعه قطعك', e:'استثمر وقتك وإلا أضاعك.' },
    { p:'العلم في الصغر كالنقش على الحجر', e:'ما تعلمته صغيراً يبقى إلى الأبد.' },
    { p:'اضرب حديدك وهو حامٍ',         e:'اغتنم الفرصة في وقتها.' },
    { p:'الكلام من الفضة والصمت من الذهب', e:'أحياناً الصمت أبلغ من الكلام.' },
    { p:'اتق شر من أحسنت إليه',        e:'لا تأمن عدوك حتى لو أكرمته.' },
    { p:'إذا كان الكلام من فضة فالسكوت من ذهب', e:'للصمت قيمة أعلى أحياناً.' },
    { p:'يد واحدة لا تصفق',           e:'التعاون ضروري لإنجاز الأعمال.' },
];

const RIDDLES = [
    { q:'ما الشيء الذي كلما أخذت منه كبر؟',          a:'الحفرة 🕳️' },
    { q:'له دموع ولا يبكي، له قلب ولا يحب؟',          a:'البصل 🧅' },
    { q:'ما الشيء الذي يكسر بمجرد النطق به؟',          a:'الصمت 🤫' },
    { q:'له عيون ولا يرى، وله أذن ولا يسمع؟',          a:'الإبرة والخيط 🪡' },
    { q:'أبيض اللون، طيب الرائحة، يُشرب ولا يؤكل؟',    a:'الحليب 🥛' },
    { q:'ما هو الشيء الذي يُصنع ليُكسر؟',              a:'البيضة 🥚' },
    { q:'يرفع الصوت ولا يملك فماً؟',                   a:'الطبل 🥁' },
    { q:'يأتي مرة في الدقيقة، مرتين في اللحظة، ولا يأتي في ألف سنة؟', a:'حرف الميم 🔤' },
];

const WOULD_RATHER = [
    'تكون غنياً بلا أصدقاء أم فقيراً مع أصدقاء أوفياء؟',
    'تسافر كل شهر أم تبقى في وطنك وتبنيه؟',
    'تكون مشهوراً أم سعيداً في سرك؟',
    'تتكلم كل اللغات أم تعزف كل الآلات الموسيقية؟',
    'تعيش بلا إنترنت لسنة أم بلا موسيقى للأبد؟',
    'تعرف تاريخ وفاتك أم لا تعرف أبداً؟',
    'تكون طياراً أم غواصاً محترفاً؟',
];

async function handle(ctx) {
    const { command, sock, jid, msg, reply, args, text,
            sender, senderId, isOwner, isAdmin, isGroup, mentionedJid } = ctx;

    // ══════════ الفئة 1: أدوات ذكية (20 أمر) ══════════

    // 1. تشفير Base64
    if (['شفرة','encode_b64'].includes(command)) {
        if (!text) return reply('📌 .شفرة [نص]') && true;
        await reply(`🔐 *Base64:*\n\n\`${Buffer.from(text,'utf8').toString('base64')}\`\n\n💡 .فك_شفرة [النص] للفك`);
        return true;
    }

    // 2. فك تشفير Base64
    if (['فك_شفرة','decode_b64'].includes(command)) {
        if (!text) return reply('📌 .فك_شفرة [نص مشفر]') && true;
        try {
            await reply(`🔓 *النص الأصلي:*\n\n${Buffer.from(text.trim(),'base64').toString('utf8')}`);
        } catch { await reply('❌ النص ليس Base64 صالحاً.'); }
        return true;
    }

    // 3. مورس كود
    if (['مورس','morse'].includes(command)) {
        if (!text) return reply('📌 .مورس [نص]') && true;
        await reply(`📡 *مورس كود:*\n\n${toMorse(text)}`);
        return true;
    }

    // 4. نص Leet
    if (['ليت','leet'].includes(command)) {
        if (!text) return reply('📌 .ليت [نص]') && true;
        await reply(`😎 *L337 T3XT:*\n\n${toLeet(text)}`);
        return true;
    }

    // 5. نص مقلوب
    if (['مقلوب','reverse_text'].includes(command)) {
        if (!text) return reply('📌 .مقلوب [نص]') && true;
        await reply(`🔄 *مقلوب:*\n\n${[...text].reverse().join('')}`);
        return true;
    }

    // 6. عدّ الكلمات
    if (['عد_كلمات','word_count'].includes(command)) {
        if (!text) return reply('📌 .عد_كلمات [نص]') && true;
        const words = text.trim().split(/\s+/).length;
        const chars = text.length;
        const sentences = (text.match(/[.!?؟।]/g)||[]).length + 1;
        await reply(`📊 *إحصائيات النص:*\n\n📝 الكلمات: ${words}\n🔤 الأحرف: ${chars}\n📌 الجمل تقريباً: ${sentences}`);
        return true;
    }

    // 7. الأرقام الرومانية
    if (['روماني','roman'].includes(command)) {
        const n = parseInt(text);
        if (!n || n < 1 || n > 3999) return reply('📌 .روماني [1-3999]') && true;
        await reply(`🏛️ ${n} = *${toRoman(n)}*`);
        return true;
    }

    // 8. فحص العدد الأولي
    if (['اولي','prime_check'].includes(command)) {
        const n = parseInt(text);
        if (!text || isNaN(n)) return reply('📌 .اولي [رقم]') && true;
        await reply(`🔢 *${n}* ${isPrime(n) ? '✅ عدد أولي!' : '❌ ليس عدداً أولياً.'}`);
        return true;
    }

    // 9. تحويل درجة الحرارة
    if (['حرارة','temp_convert'].includes(command)) {
        if (!text) return reply('📌 .حرارة 100c  أو  .حرارة 212f') && true;
        const [, valStr, unit] = text.trim().match(/^([\d.]+)\s*([cfkCFK])$/) || [];
        const val = parseFloat(valStr);
        if (!unit || isNaN(val)) return reply('📌 مثال: .حرارة 100c  أو  .حرارة 37c') && true;
        const u = unit.toLowerCase();
        if (u === 'c') await reply(`🌡️ ${val}°C = *${((val*9/5)+32).toFixed(2)}°F* = *${(val+273.15).toFixed(2)} K*`);
        else if (u === 'f') { const c = ((val-32)*5/9).toFixed(2); await reply(`🌡️ ${val}°F = *${c}°C* = *${(parseFloat(c)+273.15).toFixed(2)} K*`); }
        else { const c = (val-273.15).toFixed(2); await reply(`🌡️ ${val}K = *${c}°C* = *${((parseFloat(c)*9/5)+32).toFixed(2)}°F*`); }
        return true;
    }

    // 10. مولّد UUID
    if (['uuid','معرف_فريد'].includes(command)) {
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16);
        });
        await reply(`🆔 *UUID:*\n\n\`${uuid}\``);
        return true;
    }

    // 11. حساب BMI
    if (['bmi','مؤشر_الجسم'].includes(command)) {
        const [w, h] = (text||'').split(/\s+/).map(Number);
        if (!w || !h) return reply('📌 .bmi [الوزن كجم] [الطول سم]\nمثال: .bmi 70 175') && true;
        const bmi = (w / Math.pow(h/100, 2)).toFixed(1);
        const status = +bmi<18.5?'نحافة ⚠️':+bmi<25?'وزن مثالي ✅':+bmi<30?'زيادة وزن 🟡':'سمنة 🔴';
        await reply(`⚖️ *BMI:* ${bmi} — ${status}\n\n💡 المثالي: 18.5 – 24.9`);
        return true;
    }

    // 12. حساب العمر
    if (['عمري','calc_age'].includes(command)) {
        const y = parseInt(text);
        if (!y || y < 1900 || y > new Date().getFullYear()) return reply('📌 .عمري [سنة الميلاد]') && true;
        const age = new Date().getFullYear() - y;
        await reply(`🎂 العمر: *${age} سنة* (≈ ${(age*365.25).toFixed(0)} يوم)`);
        return true;
    }

    // 13. تاريخ الميلاد التفصيلي
    if (['تاريخ_ميلاد','birthday_calc'].includes(command)) {
        if (!text) return reply('📌 .تاريخ_ميلاد 15-6-1995') && true;
        const parts = text.split(/[-\/]/);
        if (parts.length < 3) return reply('📌 صيغة: يوم-شهر-سنة  مثال: 15-6-1995') && true;
        const dob  = new Date(+parts[2], +parts[1]-1, +parts[0]);
        const now  = new Date();
        const age  = now.getFullYear() - dob.getFullYear();
        const next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        const daysLeft = Math.ceil((next - now) / 86400000);
        await reply(`🎂 العمر: *${age} سنة*\n⏳ عيد الميلاد القادم بعد: *${daysLeft} يوم*`);
        return true;
    }

    // 14. عداد تنازلي
    if (['عد_تنازلي','countdown'].includes(command)) {
        const secs = parseInt(text);
        if (!secs || secs < 1 || secs > 300) return reply('📌 .عد_تنازلي [1-300 ثانية]') && true;
        await reply(`⏱️ عداد تنازلي: *${secs}* ثانية — بدأ ✅`);
        setTimeout(async () => {
            await sock.sendMessage(jid, { text: `🔔 @${senderId} انتهى العداد! ⏰`, mentions: [sender] });
        }, secs * 1000);
        return true;
    }

    // 15. التوقيت العالمي
    if (['توقيت','world_time'].includes(command)) {
        const TZ = {
            'القاهرة':'Africa/Cairo','الرياض':'Asia/Riyadh','دبي':'Asia/Dubai',
            'لندن':'Europe/London','نيويورك':'America/New_York','باريس':'Europe/Paris',
            'طوكيو':'Asia/Tokyo','سيدني':'Australia/Sydney','موسكو':'Europe/Moscow',
            'بكين':'Asia/Shanghai','لوس_انجلوس':'America/Los_Angeles',
        };
        const city = text || 'القاهرة';
        const tz   = TZ[city] || 'Africa/Cairo';
        const t    = new Date().toLocaleTimeString('ar', { timeZone: tz, hour:'2-digit', minute:'2-digit' });
        await reply(`🕐 *${city}:* ${t}`);
        return true;
    }

    // 16. قائمة مهام شخصية
    if (['مهام','todo'].includes(command)) {
        if (!db.users[senderId]) db.users[senderId] = {};
        if (!db.users[senderId].todos) db.users[senderId].todos = [];
        const todos = db.users[senderId].todos;
        if (args[0] === 'اضف' && args.length > 1) {
            todos.push(args.slice(1).join(' ')); saveDB();
            await reply(`✅ أُضيفت: "${todos[todos.length-1]}"`);
        } else if (args[0] === 'حذف') {
            const i = parseInt(args[1]) - 1;
            if (i >= 0 && i < todos.length) { todos.splice(i, 1); saveDB(); await reply('🗑️ حُذفت.'); }
            else await reply('❌ رقم خاطئ.');
        } else if (args[0] === 'مسح') {
            db.users[senderId].todos = []; saveDB(); await reply('🗑️ مُسحت كل المهام.');
        } else {
            if (!todos.length) return reply('📋 فارغة. .مهام اضف [مهمة]') && true;
            await reply(`📋 *مهامك:*\n\n${todos.map((t,i)=>`${i+1}. ${t}`).join('\n')}\n\n_.مهام اضف • .مهام حذف [رقم] • .مهام مسح_`);
        }
        return true;
    }

    // 17. ملاحظة شخصية
    if (['ملاحظة','note'].includes(command)) {
        if (!db.users[senderId]) db.users[senderId] = {};
        if (text) {
            db.users[senderId].note = text; saveDB();
            await reply(`📝 حُفظت: "${text}"`);
        } else {
            const n = db.users[senderId].note;
            await reply(n ? `📝 *ملاحظتك:*\n\n${n}` : '📝 لا توجد ملاحظة. .ملاحظة [نص]');
        }
        return true;
    }

    // 18. حاسبة متقدمة
    if (['احسب','calc_adv'].includes(command)) {
        if (!text) return reply('📌 .احسب [عملية]\nمثال: .احسب sqrt(144)  أو  .احسب 2^10') && true;
        try {
            const safe = text.replace(/sqrt\(([^)]+)\)/g, (_, n) => String(Math.sqrt(+n)))
                             .replace(/\^/g, '**').replace(/[^0-9+\-*/.() ]/g,'');
            // eslint-disable-next-line no-new-func
            const result = Function(`"use strict"; return (${safe})`)();
            await reply(`🧮 *${text}* = *${result}*`);
        } catch { await reply('❌ عملية غير صالحة.'); }
        return true;
    }

    // 19. لون هكس عشوائي
    if (['لون_هكس','hex_color'].includes(command)) {
        const hex = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
        const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
        await reply(`🎨 *لون عشوائي:*\n\nHEX: \`${hex}\`\nRGB: rgb(${r}, ${g}, ${b})`);
        return true;
    }

    // 20. مولّد نص lorem عربي
    if (['lorem','نص_عشوائي'].includes(command)) {
        const pool = ['الحياة','الأمل','النجاح','الصبر','الإبداع','العلم','الوقت','الإرادة','القوة','الوطن','الأسرة'];
        const count = Math.min(parseInt(args[0])||30, 100);
        const text2 = Array.from({length:count}, ()=>pool[randomInt(0,pool.length-1)]).join(' ')+'...';
        await reply(`📝 *نص عشوائي (${count} كلمة):*\n\n${text2}`);
        return true;
    }

    // ══════════ الفئة 2: صحة ولياقة (10 أوامر) ══════════

    // 21. تمرين اليوم
    if (['تمرين','workout'].includes(command)) {
        const workouts = [
            '💪 20 ضغطة + 30 قرفصة + 15 عقلة — 3 جولات',
            '🏃 30 دقيقة مشي سريع (6000 خطوة)',
            '🧘 15 دقيقة يوغا + تمدد شامل',
            '🚴 ركوب دراجة 20 دقيقة (حقيقية أو هوائية)',
            '⚽ تمرين HIIT: 20 ثانية جهد + 10 ثوانٍ راحة × 8',
            '🏊 سباحة 20 دقيقة أو بديلها المشي في الماء',
            '🤸 بلانك 60 ثانية + جسر 30 ثانية × 4',
        ];
        await reply(`🏋️ *تمرين اليوم:*\n\n${workouts[randomInt(0,workouts.length-1)]}\n\n💡 إحماء 5 دقائق قبله!`);
        return true;
    }

    // 22. تذكير الماء
    if (['ماء','water_reminder'].includes(command)) {
        const glasses = parseInt(text) || 8;
        await reply(`💧 *هدفك اليوم: ${glasses} أكواب ماء*\n\n${'🥛'.repeat(glasses)}\n\n💡 كوب كل ساعة تقريباً`);
        return true;
    }

    // 23. حساب السعرات
    if (['سعرات','calories'].includes(command)) {
        if (!text) return reply('📌 .سعرات [الطعام]\nمثال: .سعرات كوب أرز مطبوخ') && true;
        const cal = await askGemini(`كم تقريباً السعرات الحرارية في "${text}"؟ رقم تقريبي + جملة تفسيرية.`);
        await reply(`🍽️ *${text}:*\n\n${cal}`);
        return true;
    }

    // 24. نصيحة صحية
    if (['صحة','health_tip'].includes(command)) {
        const tip = await askGemini('نصيحة صحية علمية واحدة مهمة وسهلة التطبيق. (جملتان فقط)');
        await reply(`🏥 *نصيحة صحية:*\n\n${tip}`);
        return true;
    }

    // 25. دقيقة تأمل موجّه
    if (['تأمل','meditation'].includes(command)) {
        await reply(
            `🧘 *دقيقة تأمل موجَّه:*\n\n` +
            `1️⃣ اجلس مريحاً واغمض عينيك\n` +
            `2️⃣ شهيق عميق ببطء (4 ثوانٍ)\n` +
            `3️⃣ احبس نفسك (4 ثوانٍ)\n` +
            `4️⃣ زفير طويل (6 ثوانٍ)\n` +
            `5️⃣ كرِّر 5 مرات\n\n` +
            `✨ ركِّز فقط على تنفسك ودع أفكارك تمرّ`
        );
        return true;
    }

    // 26. تحدي لياقة
    if (['تحدي_لياقة','fitness_challenge'].includes(command)) {
        const ch = [
            '🔥 30 يومياً من اليوم: 10 ضغطات إضافية كل يوم!',
            '🏃 تحدي 5 كيلومتر: سجِّل وقتك وحاول تكسره الأسبوع القادم',
            '🧘 7 أيام يوغا: 15 دقيقة صباح كل يوم',
            '⚡ No sugar challenge: أسبوع بلا سكر مضاف — هل تستطيع؟',
        ];
        await reply(`🔥 *تحدي اللياقة:*\n\n${ch[randomInt(0,ch.length-1)]}`);
        return true;
    }

    // 27. نصائح النوم الجيد
    if (['نوم_جيد','sleep_tips'].includes(command)) {
        await reply(
            `😴 *نصائح للنوم الجيد:*\n\n` +
            `1️⃣ نَم في وقت ثابت كل يوم\n` +
            `2️⃣ أبعد الهاتف ساعة قبل النوم\n` +
            `3️⃣ اجعل الغرفة مظلمة وباردة قليلاً\n` +
            `4️⃣ تجنَّب الكافيين بعد الساعة 2 ظهراً\n` +
            `5️⃣ اقرأ كتاباً بدلاً من التصفح\n\n` +
            `💤 النوم الجيد = إنتاجية أفضل + مزاج أحسن`
        );
        return true;
    }

    // 28. قياس مستوى التوتر
    if (['توتر','stress_check'].includes(command)) {
        const level = randomInt(1, 10);
        const advice = level <= 3 ? '💚 أنت هادئ، واصل!' : level <= 6 ? '🟡 توتر معتدل، خذ استراحة.' : '🔴 توتر عالٍ! تنفَّس واسترخِ الآن.';
        await reply(`😤 *مقياس التوتر لـ @${senderId}:*\n\n${bar(level)} ${level}/10\n\n${advice}`, { mentions: [sender] });
        return true;
    }

    // 29. سعرات مفروقة في الوجبات
    if (['وجبات','meal_plan'].includes(command)) {
        const plan = await askGemini('اقترح توزيع سعرات 2000 سعرة على 3 وجبات رئيسية ووجبتين خفيفتين. (مختصر جداً)');
        await reply(`🍱 *توزيع الوجبات اليومية:*\n\n${plan}`);
        return true;
    }

    // 30. رياضة للمبتدئين
    if (['ابدأ_رياضة','beginner_workout'].includes(command)) {
        const guide = await askGemini('خطة تمارين بسيطة للمبتدئ يُطبِّقها في البيت بدون أدوات. (5 نقاط مختصرة)');
        await reply(`🌟 *رياضة للمبتدئين:*\n\n${guide}`);
        return true;
    }

    // ══════════ الفئة 3: معرفة وتعليم (15 أمر) ══════════

    // 31. تعريف مصطلح
    if (['عرّف','define'].includes(command)) {
        if (!text) return reply('📌 .عرّف [مصطلح]') && true;
        const d = await askGemini(`عرِّف "${text}" بشكل علمي مبسَّط. (3 أسطر فقط)`);
        await reply(`📚 *${text}:*\n\n${d}`);
        return true;
    }

    // 32. من اخترع
    if (['من_اخترع','who_invented'].includes(command)) {
        if (!text) return reply('📌 .من_اخترع [شيء]') && true;
        const a = await askGemini(`من اخترع "${text}"؟ متى؟ أجب بجملتين.`);
        await reply(`💡 *من اخترع ${text}:*\n\n${a}`);
        return true;
    }

    // 33. في هذا اليوم من التاريخ
    if (['في_يوم','on_this_day'].includes(command)) {
        const today = new Date().toLocaleDateString('ar', { month:'long', day:'numeric' });
        const events = await askGemini(`أذكر 3 أحداث تاريخية مهمة وقعت في ${today} حول العالم. (قائمة مختصرة)`);
        await reply(`📅 *في ${today} من التاريخ:*\n\n${events}`);
        return true;
    }

    // 34. مقارنة دولتين
    if (['قارن_دول','compare_countries'].includes(command)) {
        if (!text) return reply('📌 .قارن_دول مصر والسعودية') && true;
        const c = await askGemini(`قارن بين ${text} من حيث المساحة والسكان والاقتصاد وأبرز المعالم. جدول نقاط مختصر.`);
        await reply(`🌍 *مقارنة:*\n\n${c}`);
        return true;
    }

    // 35. لماذا؟
    if (['لماذا','why'].includes(command)) {
        if (!text) return reply('📌 .لماذا السماء زرقاء') && true;
        const a = await askGemini(`لماذا ${text}؟ أجب ببساطة في 3 أسطر.`);
        await reply(`🤔 *لماذا ${text}؟*\n\n${a}`);
        return true;
    }

    // 36. كيف يعمل؟
    if (['كيف_يعمل','how_works'].includes(command)) {
        if (!text) return reply('📌 .كيف_يعمل المحرك') && true;
        const h = await askGemini(`كيف يعمل "${text}"؟ شرح مبسَّط في 4 أسطر.`);
        await reply(`⚙️ *كيف يعمل ${text}:*\n\n${h}`);
        return true;
    }

    // 37. معلومة علمية مدهشة
    if (['علم','science_fact'].includes(command)) {
        const topic = text || 'الفضاء';
        const f = await askGemini(`أعطني حقيقة علمية مدهشة وغير معروفة كثيراً عن "${topic}". (3 أسطر)`);
        await reply(`🔬 *حقيقة علمية:*\n\n${f}`);
        return true;
    }

    // 38. عاصمة الدولة
    if (['عاصمة','capital'].includes(command)) {
        if (!text) return reply('📌 .عاصمة فرنسا') && true;
        const c = await askGemini(`ما عاصمة ${text}؟ عدد سكانها؟ ما يميزها؟ (3 جمل)`);
        await reply(`🏛️ *${text}:*\n\n${c}`);
        return true;
    }

    // 39. حقيقة الفضاء
    if (['فضاء','space_fact'].includes(command)) {
        const f = await askGemini('حقيقة فضائية مذهلة تُبهر العقول. (3 أسطر)');
        await reply(`🚀 *حقيقة فضائية:*\n\n${f}`);
        return true;
    }

    // 40. كيف تتعلم شيئاً
    if (['كيف_تتعلم','how_to_learn'].includes(command)) {
        if (!text) return reply('📌 .كيف_تتعلم البرمجة') && true;
        const g = await askGemini(`خطة 3 أشهر لتعلم "${text}" من الصفر. (5 نقاط مختصرة)`);
        await reply(`📖 *كيف تتعلم ${text}:*\n\n${g}`);
        return true;
    }

    // 41. شرح مصطلح تقني
    if (['تقني','tech_explain'].includes(command)) {
        if (!text) return reply('📌 .تقني API') && true;
        const e = await askGemini(`اشرح "${text}" بأسلوب بسيط للمبتدئ. (3 أسطر + مثال واحد)`);
        await reply(`💻 *${text}:*\n\n${e}`);
        return true;
    }

    // 42. أفضل لغة برمجة لـ
    if (['لغة_برمجة','best_language'].includes(command)) {
        const g = text || 'تطوير تطبيقات';
        const r = await askGemini(`أفضل لغة برمجة لـ "${g}" مع سبب مختصر. (3 أسطر)`);
        await reply(`💻 *أفضل لغة لـ ${g}:*\n\n${r}`);
        return true;
    }

    // 43. مقارنة تقنية
    if (['قارن_تقني','compare_tech'].includes(command)) {
        if (!text) return reply('📌 .قارن_تقني Python vs JavaScript') && true;
        const c = await askGemini(`قارن بين ${text} بشكل مختصر في 5 نقاط.`);
        await reply(`⚙️ *مقارنة:*\n\n${c}`);
        return true;
    }

    // 44. نصيحة أمان رقمي
    if (['امان_رقمي','digital_security'].includes(command)) {
        const t = await askGemini('نصيحة أمان رقمي مهمة وعملية. (جملتان فقط)');
        await reply(`🔒 *أمان رقمي:*\n\n${t}`);
        return true;
    }

    // 45. ما الفرق بين
    if (['الفرق','difference'].includes(command)) {
        if (!text) return reply('📌 .الفرق بين الذكاء الاصطناعي والتعلم الآلي') && true;
        const d = await askGemini(`ما الفرق بين ${text}؟ (3 أسطر بسيطة)`);
        await reply(`🔍 *الفرق:*\n\n${d}`);
        return true;
    }

    // ══════════ الفئة 4: إبداع وكتابة (10 أوامر) ══════════

    // 46. تغريدة إبداعية
    if (['تغريدة','tweet'].includes(command)) {
        const t = await askGemini(`تغريدة إبداعية قصيرة (أقل من 280 حرف) عن "${text||'الحياة'}". بدون هاشتاق.`);
        await reply(`🐦 *تغريدة:*\n\n${t}`);
        return true;
    }

    // 47. كابشن انستجرام
    if (['منشور','instagram_post'].includes(command)) {
        const p = await askGemini(`كابشن انستجرام جذاب لـ "${text||'صورة جميلة'}" مع إيموجيات مناسبة.`);
        await reply(`📸 *كابشن:*\n\n${p}`);
        return true;
    }

    // 48. شعار تسويقي
    if (['شعار','slogan'].includes(command)) {
        if (!text) return reply('📌 .شعار [فكرة أو منتج]') && true;
        const s = await askGemini(`اكتب 3 شعارات تسويقية قصيرة وجذابة لـ "${text}".`);
        await reply(`✨ *شعارات ${text}:*\n\n${s}`);
        return true;
    }

    // 49. رسالة دافئة
    if (['رسالة_دافئة','warm_message'].includes(command)) {
        const target = mentionedJid[0];
        const m = await askGemini('رسالة دافئة مشجعة قصيرة لشخص يمر بيوم صعب. (5 أسطر)');
        if (target) await sock.sendMessage(jid,{text:`💌 لـ @${target.split('@')[0]}:\n\n${m}`,mentions:[target]},{quoted:msg});
        else await reply(`💌 *رسالة دافئة:*\n\n${m}`);
        return true;
    }

    // 50. قصيدة حب
    if (['قصيدة_حب','love_poem'].includes(command)) {
        const target = mentionedJid[0];
        const poem = await askGemini('قصيدة حب رومانسية بالعربية الفصيحة. (6 أبيات)');
        if (target) await sock.sendMessage(jid,{text:`💝 من @${senderId} إلى @${target.split('@')[0]}:\n\n${poem}`,mentions:[sender,target]},{quoted:msg});
        else await reply(`💝 *قصيدة حب:*\n\n${poem}`);
        return true;
    }

    // 51. أمثال شعبية
    if (['مثل','proverb'].includes(command)) {
        const entry = PROVERBS[randomInt(0, PROVERBS.length-1)];
        await reply(`📖 *مثل شعبي:*\n\n"${entry.p}"\n\n💡 ${entry.e}`);
        return true;
    }

    // 52. مرادفات
    if (['مرادفات','synonyms'].includes(command)) {
        if (!text) return reply('📌 .مرادفات [كلمة]') && true;
        const s = await askGemini(`5 مرادفات لكلمة "${text}" بالعربية.`);
        await reply(`✏️ *مرادفات ${text}:*\n\n${s}`);
        return true;
    }

    // 53. أضداد
    if (['اضداد','antonyms'].includes(command)) {
        if (!text) return reply('📌 .اضداد [كلمة]') && true;
        const a = await askGemini(`3 أضداد لكلمة "${text}" بالعربية.`);
        await reply(`🔄 *أضداد ${text}:*\n\n${a}`);
        return true;
    }

    // 54. فكرة مشروع
    if (['فكرة_مشروع','project_idea'].includes(command)) {
        const f = text || 'التكنولوجيا';
        const idea = await askGemini(`فكرة مشروع مبتكر في "${f}" مع خطوات تنفيذ مختصرة جداً.`);
        await reply(`💡 *فكرة مشروع:*\n\n${idea}`);
        return true;
    }

    // 55. ابتكر حلاً
    if (['ابتكر','innovate'].includes(command)) {
        const p = text || 'مشكلة يومية';
        const sol = await askGemini(`حل مبتكر وغير تقليدي لـ "${p}". (فكرة + خطوتان)`);
        await reply(`🚀 *ابتكار:*\n\n${sol}`);
        return true;
    }

    // ══════════ الفئة 5: مجتمعي وجروب (15 أمر) ══════════

    // 56. عيد ميلاد
    if (['عيد_ميلاد','happy_birthday'].includes(command)) {
        const target = mentionedJid[0] || sender;
        await sock.sendMessage(jid, {
            text: `🎂🎉 *عيد ميلاد سعيد يا @${target.split('@')[0]}!* 🎉🎂\n\n🌟 كل عام وأنت بخير\n🌹 أعاد الله عليك هذا اليوم أعواماً مديدة\n✨ بصحة وسعادة وتوفيق دائم\n\n${'🎈'.repeat(5)}`,
            mentions: [target]
        }, { quoted: msg });
        return true;
    }

    // 57. تهنئة
    if (['تهنئة','congrats'].includes(command)) {
        const target = mentionedJid[0];
        const occ = text || 'مناسبتك';
        const m = await askGemini(`رسالة تهنئة جميلة بـ "${occ}". (4 أسطر)`);
        if (target) await sock.sendMessage(jid,{text:`🎊 @${target.split('@')[0]}\n\n${m}`,mentions:[target]},{quoted:msg});
        else await reply(`🎊 *تهنئة:*\n\n${m}`);
        return true;
    }

    // 58. رسالة شكر
    if (['شكر','thank_you'].includes(command)) {
        const target = mentionedJid[0];
        const t = await askGemini('رسالة شكر صادقة وجميلة. (3 أسطر)');
        if (target) await sock.sendMessage(jid,{text:`🙏 @${target.split('@')[0]}\n\n${t}`,mentions:[target]},{quoted:msg});
        else await reply(`🙏 ${t}`);
        return true;
    }

    // 59. رسالة اعتذار
    if (['اعتذار','apology'].includes(command)) {
        const target = mentionedJid[0];
        const a = await askGemini('رسالة اعتذار صادقة ورقيقة. (3 أسطر)');
        if (target) await sock.sendMessage(jid,{text:`💙 @${target.split('@')[0]}\n\n${a}`,mentions:[target]},{quoted:msg});
        else await reply(`💙 ${a}`);
        return true;
    }

    // 60. رسالة تشجيع
    if (['تشجيع','encourage'].includes(command)) {
        const target = mentionedJid[0] || sender;
        const e = await askGemini('رسالة تشجيع قوية ومحفزة. (4 أسطر)');
        await sock.sendMessage(jid, { text: `💪 @${target.split('@')[0]}\n\n${e}`, mentions: [target] }, { quoted: msg });
        return true;
    }

    // 61. توافق شخصين
    if (['توافق','love_calc'].includes(command)) {
        const names = mentionedJid.length >= 2
            ? [mentionedJid[0].split('@')[0], mentionedJid[1].split('@')[0]]
            : (text||'').split(/\s+/);
        if (names.length < 2 || !names[1]) return reply('📌 .توافق @شخص1 @شخص2  أو  .توافق أحمد سارة') && true;
        const score = (names.join('').split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % 101;
        const heart = score >= 80 ? '❤️❤️❤️' : score >= 50 ? '💛💛' : '💔';
        await reply(`💞 *توافق ${names[0]} و ${names[1]}:*\n\n${heart} ${score}%\n\n${score>=80?'💑 توافق رائع!':score>=50?'🙂 علاقة جيدة':'😅 يحتاج وقتاً'}`);
        return true;
    }

    // 62. تصنيف الأعضاء (جروب فقط)
    if (['صنّف','classify_members'].includes(command)) {
        if (!isGroup) return reply('⚠️ للمجموعات فقط.') && true;
        const meta = await sock.groupMetadata(jid);
        const members = meta.participants.slice(0, 5);
        const cats = ['🦁 الأسد','🦊 الثعلب','🦉 البومة','🐢 السلحفاة','🦋 الفراشة'];
        const lines = members.map((m,i) => `${cats[i]}: @${m.id.split('@')[0]}`).join('\n');
        await sock.sendMessage(jid, { text:`🎭 *تصنيف اليوم:*\n\n${lines}`, mentions: members.map(m=>m.id) }, { quoted: msg });
        return true;
    }

    // 63. لقب عشوائي لعضو
    if (['لقب','nickname'].includes(command)) {
        const target = mentionedJid[0] || sender;
        const nicks = ['سلطان الجروب 👑','النينجا الخفي 🥷','بطل المعركة ⚔️','حكيم الزمان 🦉','صاحب النكات 😂','الصامت الخطير 😶','نجم المجموعة ⭐','الكابتن 🚀'];
        await sock.sendMessage(jid, { text:`🎖️ لقب @${target.split('@')[0]} اليوم:\n\n*${nicks[randomInt(0,nicks.length-1)]}*`, mentions:[target] }, { quoted: msg });
        return true;
    }

    // 64. عضو اليوم
    if (['عضو_اليوم','member_of_day'].includes(command)) {
        if (!isGroup) return reply('⚠️ للمجموعات فقط.') && true;
        const meta = await sock.groupMetadata(jid);
        const chosen = meta.participants[randomInt(0, meta.participants.length-1)];
        await sock.sendMessage(jid, { text:`🌟 *عضو اليوم:*\n\n👑 @${chosen.id.split('@')[0]}\n\n🎊 مبروك! أنت نجم اليوم!`, mentions:[chosen.id] }, { quoted: msg });
        return true;
    }

    // 65. سؤال للجروب
    if (['سؤال_اسبوع','week_question'].includes(command)) {
        const questions = [
            'لو كان عندك يوم إضافي في الأسبوع ماذا تفعل؟',
            'لو سافرت لأي مكان في العالم الآن أين تذهب؟',
            'ما الموهبة التي تتمنى امتلاكها؟',
            'ما أهم شيء تريد تحقيقه هذا العام؟',
            'ما آخر كتاب قرأته وأثَّر فيك؟',
            'لو عدت للماضي ماذا تغير في حياتك؟',
        ];
        await reply(`❓ *سؤال للنقاش:*\n\n${questions[randomInt(0,questions.length-1)]}\n\nشاركنا رأيك! 💬`);
        return true;
    }

    // 66. اختبار IQ ترفيهي
    if (['اختبار_iq','iq_test'].includes(command)) {
        const score = randomInt(80, 135);
        const level = score>=130?'عبقري 🧠':score>=120?'متقدم جداً ⭐':score>=110?'فوق المتوسط ✅':'متوسط 👍';
        await reply(`🧠 *اختبار IQ ترفيهي*\n\n@${senderId}: ${score} — ${level}\n\n⚠️ ترفيهي فقط 😄`, { mentions: [sender] });
        return true;
    }

    // 67. حظك اليوم
    if (['حظك','lucky_today'].includes(command)) {
        const luck = randomInt(1, 100);
        const icons = luck>=80?'🍀🌟💎':luck>=50?'⭐✨':'😐';
        await reply(`🎱 *حظ @${senderId} اليوم:*\n\n${icons} ${luck}%\n\n${luck>=80?'يوم موفق إن شاء الله!':luck>=50?'يوم عادي، اصنع حظك!':'لا تيأس الغد أفضل!'}`, { mentions: [sender] });
        return true;
    }

    // 68. مقارنة شخصين
    if (['مقارنة','compare_persons'].includes(command)) {
        if (mentionedJid.length < 2) return reply('📌 .مقارنة @شخص1 @شخص2') && true;
        const [a, b] = mentionedJid.map(j => j.split('@')[0]);
        const traits = ['الذكاء','الكرم','الطاقة','الإبداع','الجاذبية'];
        const lines  = traits.map(t => {
            const sa = randomInt(60,100), sb = randomInt(60,100);
            return `${t}:\n@${a}: ${bar(sa)} ${sa}%\n@${b}: ${bar(sb)} ${sb}%`;
        }).join('\n\n');
        await sock.sendMessage(jid, { text:`⚔️ *مقارنة:*\n\n${lines}`, mentions: mentionedJid }, { quoted: msg });
        return true;
    }

    // 69. تغريدة للمجموعة
    if (['اعلان','group_announce'].includes(command)) {
        if (!isAdmin && !isOwner) return reply('❌ للأدمن فقط.') && true;
        if (!text) return reply('📌 .اعلان [النص]') && true;
        await sock.sendMessage(jid, {
            text: `📢 *إعلان*\n${'━'.repeat(20)}\n\n${text}\n\n${'━'.repeat(20)}`,
        });
        return true;
    }

    // 70. تصويت سريع
    if (['تصويت','poll'].includes(command)) {
        if (!text) return reply('📌 .تصويت [السؤال]\nيصوِّت الأعضاء بـ 👍 أو 👎') && true;
        await reply(`📊 *تصويت:*\n\n❓ ${text}\n\n👍 أوافق  |  👎 لا أوافق\n\n_ردُّوا بإيموجيك!_`);
        return true;
    }

    // ══════════ الفئة 6: ألعاب نصية (10 أوامر) ══════════

    // 71. أحجية
    if (['أحجية','riddle'].includes(command)) {
        const r = RIDDLES[randomInt(0, RIDDLES.length-1)];
        await reply(`🧩 *أحجية:*\n\n❓ ${r.q}\n\n||الجواب: ${r.a}||`);
        return true;
    }

    // 72. تفضَّل (Would you rather)
    if (['تفضّل','would_rather'].includes(command)) {
        await reply(`🤔 *تفضَّل:*\n\n${WOULD_RATHER[randomInt(0,WOULD_RATHER.length-1)]}\n\nردَّ وأخبرنا! 💬`);
        return true;
    }

    // 73. لعبة الذاكرة
    if (['ذاكرة','memory_game'].includes(command)) {
        const len = Math.min(parseInt(args[0])||5, 10);
        const seq = Array.from({length:len}, ()=>randomInt(1,9)).join('');
        await reply(`🧠 *لعبة الذاكرة!*\n\nاحفظ: *${seq}*\n\n⏱️ 10 ثوانٍ ثم احذف الرسالة!`);
        return true;
    }

    // 74. من أنا؟
    if (['من_أنا','who_am_i'].includes(command)) {
        const clues = await askGemini('اكتب 3 تلميحات لشيء مشهور (حيوان أو دولة أو شيء) بصيغة "أنا..." دون ذكر الاسم.');
        await reply(`🕵️ *من أنا؟*\n\n${clues}\n\nخمِّن! 🤔`);
        return true;
    }

    // 75. جملة ناقصة
    if (['كمّل','complete_sentence'].includes(command)) {
        const sentences = [
            'الصبر مفتاح...',
            'العلم في الصغر...',
            'من جدَّ وجد...',
            'الوقت من...',
            'الصديق الحقيقي هو...',
            'النجاح يحتاج...',
        ];
        await reply(`✏️ *كمِّل الجملة:*\n\n"${sentences[randomInt(0,sentences.length-1)]}"\n\nما رأيك؟ 💬`);
        return true;
    }

    // 76. كلمة بكلمة
    if (['كلمة_بكلمة','word_chain'].includes(command)) {
        const word = text || 'مرحبا';
        await reply(`🔤 *كلمة بكلمة!*\n\nالكلمة: *${word}*\n✏️ اكتب كلمة تبدأ بـ: *${[...word][word.length-1]}*`);
        return true;
    }

    // 77. سؤال ثقافي
    if (['سؤال_ثقافي','culture_quiz'].includes(command)) {
        const q = await askGemini('سؤال ثقافي مثير مع 4 خيارات أبجدية وإجابة صحيحة في آخر السطر. (لا تستخدم JSON)');
        await reply(`🏛️ *سؤال ثقافي:*\n\n${q}`);
        return true;
    }

    // 78. عداد الرسائل اليومي
    if (['عدادي','my_count'].includes(command)) {
        const user = getUser(senderId);
        await reply(`📊 *إحصائياتك:*\n\n💬 النقاط: ${user.xp}\n🏆 المستوى: ${user.level}\n📅 انضممت منذ: ${new Date(user.joinedAt||Date.now()).toLocaleDateString('ar')}`);
        return true;
    }

    // 79. رقم عشوائي
    if (['رقم','random_num'].includes(command)) {
        const [a, b] = (text||'1 100').split(/\s+/).map(Number);
        const min = isNaN(a) ? 1 : a;
        const max = isNaN(b) ? 100 : b;
        await reply(`🎲 *رقم عشوائي بين ${min} و ${max}:*\n\n*${randomInt(min, max)}*`);
        return true;
    }

    // 80. اختبار سرعة الكتابة
    if (['سرعة_كتابة','typing_test'].includes(command)) {
        const texts2 = [
            'البرمجة علم وفن يجمع المنطق والإبداع',
            'النجاح يحتاج صبراً وعملاً متواصلاً دون توقف',
            'التكنولوجيا تغير حياتنا كل يوم بشكل متسارع',
        ];
        await reply(`⌨️ *اختبر سرعة كتابتك:*\n\n"${texts2[randomInt(0,texts2.length-1)]}"\n\n⏱️ ابدأ الآن! 🚀`);
        return true;
    }

    // ══════════ الفئة 7: طبيعة وعلوم (10 أوامر) ══════════

    // 81. معلومة عن حيوان
    if (['حيوان','animal_info'].includes(command)) {
        if (!text) return reply('📌 .حيوان الأسد') && true;
        const i = await askGemini(`حقائق مثيرة وسريعة عن "${text}": الموطن، التغذية، حقيقة مدهشة. (3 أسطر)`);
        await reply(`🦁 *${text}:*\n\n${i}`);
        return true;
    }

    // 82. معلومة عن نبات
    if (['نبات','plant_info'].includes(command)) {
        if (!text) return reply('📌 .نبات الورد') && true;
        const i = await askGemini(`معلومات عن نبات "${text}": الموطن، الفوائد، طريقة الزراعة. (3 أسطر)`);
        await reply(`🌿 *${text}:*\n\n${i}`);
        return true;
    }

    // 83. نصيحة بيئية
    if (['بيئة','eco_tip'].includes(command)) {
        const t = await askGemini('نصيحة بيئية عملية يمكن تطبيقها يومياً. (جملتان)');
        await reply(`🌍 *نصيحة بيئية:*\n\n${t}`);
        return true;
    }

    // 84. أجمل مكان
    if (['اجمل_مكان','beautiful_place'].includes(command)) {
        const where = text || 'العالم العربي';
        const p = await askGemini(`ما أجمل مكان في ${where} وما المميز فيه؟ (3 أسطر)`);
        await reply(`🌅 *أجمل مكان في ${where}:*\n\n${p}`);
        return true;
    }

    // 85. معلومة عن دولة
    if (['دولة','country_info'].includes(command)) {
        if (!text) return reply('📌 .دولة اليابان') && true;
        const i = await askGemini(`5 حقائق مثيرة ومختصرة عن دولة "${text}".`);
        await reply(`🌍 *${text}:*\n\n${i}`);
        return true;
    }

    // ══════════ الفئة 8: ترفيه متنوع (10 أوامر) ══════════

    // 86. مسلسل عربي مقترح
    if (['مسلسل','arabic_show'].includes(command)) {
        const g = text || 'كوميدي';
        const r = await askGemini(`اقترح مسلسلاً عربياً ${g} مشهوراً مع وصف مختصر. (3 أسطر)`);
        await reply(`📺 *مسلسل ${g}:*\n\n${r}`);
        return true;
    }

    // 87. أغنية عربية مقترحة
    if (['اغنية_عربية','arabic_song'].includes(command)) {
        const m = text || 'حماسية';
        const s = await askGemini(`اقترح أغنية عربية ${m} مع اسم المطرب. (لا تكتب الكلمات)`);
        await reply(`🎵 *أغنية ${m}:*\n\n${s}`);
        return true;
    }

    // 88. برج الأسبوع
    if (['برج_اسبوع','weekly_horoscope'].includes(command)) {
        const sign = text || 'الحمل';
        const r = await askGemini(`توقع أسبوعي إيجابي ومحفز لبرج ${sign}. (3 أسطر)`);
        await reply(`⭐ *برج ${sign} هذا الأسبوع:*\n\n${r}`);
        return true;
    }

    // 89. اقتراح هواية
    if (['هواية','hobby'].includes(command)) {
        const i = text || 'لديّ وقت حر';
        const h = await askGemini(`اقترح هواية مناسبة لشخص يقول "${i}" مع كيفية البدء. (4 أسطر)`);
        await reply(`🎨 *هواية مقترحة:*\n\n${h}`);
        return true;
    }

    // 90. نكتة إنجليزية
    if (['english_joke','نكتة_انجليزي'].includes(command)) {
        try {
            const r = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 10000 });
            await reply(`😂 *English Joke:*\n\n${r.data.setup}\n\n...${r.data.punchline}`);
        } catch { await reply('❌ تعذّر جلب النكتة.'); }
        return true;
    }

    // ══════════ الفئة 9: بوت ومتنوع (10 أوامر) ══════════

    // 91. إحصائيات البوت
    if (['احصائيات_بوت','bot_stats_full'].includes(command)) {
        const ut = process.uptime();
        const h  = Math.floor(ut/3600);
        const m  = Math.floor((ut%3600)/60);
        const s  = Math.floor(ut%60);
        const mem = (process.memoryUsage().heapUsed/1024/1024).toFixed(1);
        await reply(
            `📊 *إحصائيات البوت:*\n\n` +
            `⏱️ وقت التشغيل: ${h}h ${m}m ${s}s\n` +
            `💾 الذاكرة: ${mem} MB\n` +
            `👥 المستخدمون: ${Object.keys(db.users||{}).length}\n` +
            `👥 المجموعات: ${Object.keys(db.groups||{}).length}\n` +
            `🤖 الإصدار: v2.0\n🟢 الحالة: يعمل`
        );
        return true;
    }

    // 92. شعبية الأوامر
    if (['شعبية','popular_cmds'].includes(command)) {
        await reply(`📊 *أشهر الأوامر:*\n\n1. .سؤال 🤖\n2. .حديث 📚\n3. .آية 📖\n4. .اذكار 📿\n5. .صلاة 🕌\n6. .امبوستر 🎮\n7. .بحبك ❤️\n8. .طقس ☀️\n9. .ترجمة 🌐\n10. .ليدربورد 🏆`);
        return true;
    }

    // 93. رسالة للمطور
    if (['للمطور','to_dev'].includes(command)) {
        if (!text) return reply('📌 .للمطور [رسالتك]') && true;
        console.log(`\n📬 [للمطور] من ${senderId}: ${text}\n`);
        await reply('✅ رسالتك وصلت للمطور! شكراً 🙏');
        return true;
    }

    // 94. أيام الأسبوع
    if (['ايام','days_week'].includes(command)) {
        const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
        const today = new Date().getDay();
        const list  = days.map((d,i) => i===today ? `➡️ *${d}* ← اليوم` : `${i+1}. ${d}`).join('\n');
        await reply(`📅 *أيام الأسبوع:*\n\n${list}`);
        return true;
    }

    // 95. خطة يوم منتج
    if (['خطة_يوم','day_plan'].includes(command)) {
        const plan = await askGemini('جدول يومي منظَّم من 6 صباحاً لـ 11 مساءً لشخص يريد إنتاجية عالية. (نقاط مختصرة)');
        await reply(`📋 *خطة يوم منتج:*\n\n${plan}`);
        return true;
    }

    // 96. نصيحة للنجاح
    if (['نجاح','success_tip'].includes(command)) {
        const t = await askGemini('نصيحة واحدة عميقة للنجاح من تجارب أناس ناجحين. (جملتان)');
        await reply(`🎯 *للنجاح:*\n\n${t}`);
        return true;
    }

    // 97. عبارة تحفيزية
    if (['تحفيز','motivate'].includes(command)) {
        const q = await askGemini('عبارة تحفيزية قوية تُشعل الهمة وتدفع للعمل. (جملتان فقط)');
        await reply(`⚡ ${q}`);
        return true;
    }

    // 98. معنى اسم
    if (['معنى','name_meaning'].includes(command)) {
        if (!text) return reply('📌 .معنى [اسمك]') && true;
        const m = await askGemini(`معنى اسم "${text}" وأصله. (3 أسطر)`);
        await reply(`📛 *معنى ${text}:*\n\n${m}`);
        return true;
    }

    // 99. البوت يسألك
    if (['اسألني','ask_me'].includes(command)) {
        const q = await askGemini('سؤال فلسفي أو إبداعي مثير للتفكير. (جملة واحدة فقط)');
        await reply(`🤔 *البوت يسألك:*\n\n${q}\n\n💬 شاركنا إجابتك!`);
        return true;
    }

    // 100. صدى الصوت (تكرار ما يقوله المستخدم بتنسيق جميل)
    if (['صدى','echo'].includes(command)) {
        if (!text) return reply('📌 .صدى [نص]') && true;
        await reply(`🔊 *صدى:*\n\n✨ ${text} ✨\n\n${'═'.repeat(20)}\n\n_— @${senderId}_`, { mentions: [sender] });
        return true;
    }

    return false;
}

module.exports = { handle };
