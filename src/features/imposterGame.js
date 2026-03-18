// src/features/imposterGame.js - لعبة الإمبوستر الكاملة

const { getGame, setGame, deleteGame } = require('../database');

// ─── قواميس الكلمات (50 كلمة لكل فئة) ───
const CATEGORIES = {
    'حيوانات': [
        'أسد', 'نمر', 'فيل', 'زرافة', 'قرد', 'دب', 'ذئب', 'ثعلب', 'أرنب', 'غزال',
        'فرس', 'جمل', 'حصان', 'حمار', 'بقرة', 'خروف', 'ماعز', 'خنزير', 'دجاجة', 'بطة',
        'نسر', 'صقر', 'ببغاء', 'طاووس', 'بومة', 'دلفين', 'حوت', 'قرش', 'أخطبوط', 'سلحفاة',
        'تمساح', 'ضفدع', 'ثعبان', 'حرباء', 'عقرب', 'نحلة', 'فراشة', 'نملة', 'عنكبوت', 'جراد',
        'كنغر', 'كوالا', 'باندا', 'وعل', 'خروف_بري', 'بيزون', 'فهد', 'جاموس', 'بجع', 'طوقان'
    ],
    'وظائف': [
        'طبيب', 'مهندس', 'معلم', 'محامي', 'طيار', 'شرطي', 'جندي', 'طاهي', 'رسام', 'ممثل',
        'مغني', 'صحفي', 'مصور', 'بناء', 'نجار', 'حداد', 'كهربائي', 'سباك', 'خياط', 'حلاق',
        'صيدلاني', 'ممرض', 'مدير', 'محاسب', 'مبرمج', 'مصمم', 'مترجم', 'باحث', 'أستاذ', 'مدرب',
        'لاعب', 'حكم', 'أمن', 'حارس', 'بستاني', 'مزارع', 'صياد', 'راعي', 'نقاش', 'موسيقار',
        'قاضي', 'دبلوماسي', 'سفير', 'وزير', 'نائب', 'ميكانيكي', 'سائق', 'عامل', 'فني', 'مستشار'
    ],
    'بلاد': [
        'مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'الأردن', 'سوريا', 'لبنان',
        'العراق', 'اليمن', 'ليبيا', 'تونس', 'الجزائر', 'المغرب', 'السودان', 'موريتانيا', 'الصومال', 'جيبوتي',
        'أمريكا', 'بريطانيا', 'فرنسا', 'ألمانيا', 'إيطاليا', 'إسبانيا', 'روسيا', 'الصين', 'اليابان', 'الهند',
        'البرازيل', 'الأرجنتين', 'كندا', 'أستراليا', 'جنوب_أفريقيا', 'نيجيريا', 'كينيا', 'إثيوبيا', 'غانا', 'الكاميرون',
        'تركيا', 'إيران', 'باكستان', 'بنغلاديش', 'إندونيسيا', 'ماليزيا', 'تايلاند', 'فيتنام', 'كوريا', 'سنغافورة'
    ],
    'اكلات': [
        'كباب', 'شاورما', 'فلافل', 'حمص', 'فول', 'كشري', 'مندي', 'كبسة', 'بريياني', 'مظبي',
        'ورق_عنب', 'محشي', 'موسخن', 'مسخن', 'منسف', 'جريش', 'هريسة', 'مرقوق', 'مطازيز', 'سلن',
        'بيتزا', 'برغر', 'سوشي', 'باستا', 'تاكو', 'هوت_دوج', 'ستيك', 'سمك', 'روبيان', 'كاري',
        'قهوة', 'شاي', 'لبن', 'عصير', 'موز', 'تفاح', 'برتقال', 'عنب', 'بطيخ', 'خوخ',
        'كيكة', 'حلوى', 'آيسكريم', 'شوكولاتة', 'تمر', 'فطيرة', 'كنافة', 'قطايف', 'أم_علي', 'بقلاوة'
    ]
};

// ─── الحصول على الكلمة الصحيحة وخيارات الإمبوستر ───
function getWordAndOptions(category, correctWord) {
    const pool = CATEGORIES[category].filter(w => w !== correctWord);
    const options = [correctWord];
    while (options.length < 4) {
        const random = pool[Math.floor(Math.random() * pool.length)];
        if (!options.includes(random)) options.push(random);
    }
    // خلط الخيارات
    return options.sort(() => Math.random() - 0.5);
}

// ─── معالج لعبة الإمبوستر ───
async function handleImposter(ctx) {
    const { command, sock, jid, msg, reply, sender, senderId, isGroup, args, text } = ctx;

    // 1. بدء اللعبة
    if (command === 'امبوستر') {
        if (!isGroup) return reply("⚠️ اللعبة تعمل في المجموعات فقط.") && true;

        const category = args[0];
        if (!category || !CATEGORIES[category]) {
            return reply(`🎮 *لعبة الإمبوستر*\n\nاختر فئة:\n${Object.keys(CATEGORIES).map(c => `• ${c}`).join('\n')}\n\nمثال: .امبوستر حيوانات`) && true;
        }

        const existingGame = getGame(jid);
        if (existingGame) return reply("⚠️ هناك لعبة قيد التشغيل. استخدم .انهاء لإنهائها.") && true;

        // إنشاء لعبة جديدة في مرحلة الانتظار
        setGame(jid, {
            phase: 'lobby',
            category,
            players: [sender],
            scores: { [senderId]: 0 },
            word: null,
            imposter: null,
            votes: {},
            createdAt: Date.now()
        });

        await reply(`🎮 *لعبة الإمبوستر بدأت!*\n\n📁 الفئة: *${category}*\n👥 اكتب *.انا* للانضمام\n\nبعد انضمام اللاعبين، اكتب *.كشف* لبدء الجولة!\n\n✅ @${senderId} انضم (المُنشئ)`, { mentions: [sender] });
        return true;
    }

    // 2. الانضمام للعبة
    if (command === 'انا') {
        if (!isGroup) return true;
        const game = getGame(jid);
        if (!game) return reply("❓ لا توجد لعبة نشطة. ابدأ بـ .امبوستر") && true;
        if (game.phase !== 'lobby') return reply("⚠️ اللعبة بدأت بالفعل!") && true;
        if (game.players.includes(sender)) return reply("✅ أنت منضم بالفعل!") && true;

        game.players.push(sender);
        if (!game.scores[senderId]) game.scores[senderId] = 0;
        setGame(jid, game);

        await reply(`✅ @${senderId} انضم للعبة!\n👥 اللاعبون الآن: ${game.players.length}`, { mentions: [sender] });
        return true;
    }

    // 3. بدء الجولة (كشف)
    if (command === 'كشف') {
        if (!isGroup) return true;
        const game = getGame(jid);
        if (!game) return reply("❓ لا توجد لعبة.") && true;
        if (game.phase !== 'lobby') return reply("⚠️ الجولة بدأت بالفعل!") && true;
        if (game.players.length < 3) return reply("⚠️ تحتاج لـ 3 لاعبين على الأقل!") && true;

        // اختيار الكلمة والإمبوستر عشوائياً
        const wordList = CATEGORIES[game.category];
        const word = wordList[Math.floor(Math.random() * wordList.length)];
        const imposterIdx = Math.floor(Math.random() * game.players.length);
        const imposter = game.players[imposterIdx];
        const options = getWordAndOptions(game.category, word);

        game.word = word;
        game.imposter = imposter;
        game.phase = 'playing';
        game.votes = {};
        setGame(jid, game);

        // إرسال الكلمة للاعبين في الخاص
        for (const player of game.players) {
            const isImposter = player === imposter;
            try {
                if (isImposter) {
                    const optionsText = options.map((o, i) => `${i + 1}. ${o}`).join('\n');
                    await sock.sendMessage(player, {
                        text: `🕵️ *أنت الإمبوستر!*\n\n📁 الفئة: *${game.category}*\n\n🤔 خمن الكلمة الصحيحة:\n${optionsText}\n\n💡 استخدم *.خمن [رقم]* في الجروب`
                    });
                } else {
                    await sock.sendMessage(player, {
                        text: `🎯 *كلمتك السرية:*\n\n📁 الفئة: *${game.category}*\n🔑 الكلمة: *${word}*\n\n🤫 لا تقول الكلمة! تكلم عنها بشكل عام.`
                    });
                }
            } catch (e) {
                console.log(`⚠️ لم يمكن إرسال رسالة خاصة لـ ${player}`);
            }
        }

        const mentions = game.players;
        const playersList = game.players.map(p => `• @${p.split('@')[0]}`).join('\n');
        await sock.sendMessage(jid, {
            text: `🎮 *بدأت الجولة!*\n\n📁 الفئة: *${game.category}*\n👥 اللاعبون:\n${playersList}\n\n📩 تم إرسال الكلمة لكل لاعب في الخاص!\n🕵️ أحدهم إمبوستر...\n\n🗳️ للتصويت: *.مين @شخص*\n⏱️ لديكم 3 دقائق!`,
            mentions
        }, { quoted: msg });

        // توقيت تلقائي (3 دقائق)
        setTimeout(async () => {
            const currentGame = getGame(jid);
            if (currentGame && currentGame.phase === 'playing') {
                await sock.sendMessage(jid, { text: '⏰ انتهى الوقت! استخدم .نتيجة لإظهار النتيجة.' });
            }
        }, 3 * 60 * 1000);

        return true;
    }

    // 4. التصويت
    if (command === 'مين') {
        if (!isGroup) return true;
        const game = getGame(jid);
        if (!game || game.phase !== 'playing') return reply("❓ لا توجد جولة نشطة.") && true;
        if (!game.players.includes(sender)) return reply("⚠️ أنت لست من اللاعبين.") && true;

        const suspect = ctx.mentionedJid[0];
        if (!suspect) return reply("📌 منشن الشخص الذي تشك فيه.") && true;
        if (suspect === sender) return reply("😅 لا تصوت على نفسك!") && true;

        game.votes[senderId] = suspect.split('@')[0];
        setGame(jid, game);

        await reply(`🗳️ @${senderId} صوّت على @${suspect.split('@')[0]}`, { mentions: [sender, suspect] });

        // تحقق لو الكل صوّت
        const votedCount = Object.keys(game.votes).length;
        if (votedCount >= game.players.length - 1) { // الإمبوستر لا يصوت
            await showResults(sock, jid, msg, game);
        }
        return true;
    }

    // 5. الإمبوستر يخمن الكلمة
    if (command === 'خمن') {
        if (!isGroup) return true;
        const game = getGame(jid);
        if (!game || game.phase !== 'playing') return return_false();
        if (game.imposter !== sender) return reply("⚠️ هذا الأمر للإمبوستر فقط!") && true;

        const choice = parseInt(args[0]);
        const options = getWordAndOptions(game.category, game.word);
        
        if (isNaN(choice) || choice < 1 || choice > 4) return reply("📌 أدخل رقماً من 1 إلى 4.") && true;

        const guessedWord = options[choice - 1];
        const isCorrect = guessedWord === game.word;

        if (isCorrect) {
            game.scores[senderId] = (game.scores[senderId] || 0) + 10;
            await reply(`🎯 الإمبوستر خمّن الكلمة الصحيحة! *${game.word}*\n🏆 @${senderId} يحصل على 10 نقاط!`, { mentions: [sender] });
        } else {
            await reply(`❌ خطأ! الكلمة الصحيحة كانت: *${game.word}*`);
        }
        return true;
    }

    // 6. النتيجة
    if (command === 'نتيجة') {
        if (!isGroup) return true;
        const game = getGame(jid);
        if (!game) return reply("❓ لا توجد لعبة.") && true;
        await showResults(sock, jid, msg, game);
        return true;
    }

    // 7. إنهاء اللعبة
    if (command === 'انهاء') {
        if (!isGroup) return true;
        deleteGame(jid);
        await reply("🛑 تم إنهاء اللعبة.");
        return true;
    }

    return false;
}

async function showResults(sock, jid, msg, game) {
    // حساب التصويتات
    const voteCounts = {};
    Object.values(game.votes).forEach(v => {
        voteCounts[v] = (voteCounts[v] || 0) + 1;
    });
    
    const mostVoted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0];
    const imposterId = game.imposter.split('@')[0];
    const correctVote = mostVoted && mostVoted[0] === imposterId;

    let resultText = `
🎮 *نتيجة الجولة!*

🕵️ الإمبوستر كان: @${imposterId}
🔑 الكلمة السرية: *${game.word}*
📁 الفئة: *${game.category}*

🗳️ *التصويتات:*
${Object.entries(voteCounts).map(([id, count]) => `• @${id}: ${count} صوت`).join('\n')}
`.trim();

    if (correctVote) {
        resultText += `\n\n✅ المجموعة اكتشفت الإمبوستر! الفائزون يحصلون على 10 نقاط!`;
        // إعطاء نقاط للذين صوتوا صح
        Object.entries(game.votes).forEach(([voter, voted]) => {
            if (voted === imposterId) {
                game.scores[voter] = (game.scores[voter] || 0) + 10;
            }
        });
    } else {
        resultText += `\n\n😈 الإمبوستر نجا! فاز الإمبوستر!`;
    }

    const mentions = game.players;
    await sock.sendMessage(jid, { text: resultText, mentions }, { quoted: msg });
    
    deleteGame(jid);
}

function return_false() { return false; }

module.exports = { handleImposter, CATEGORIES };
