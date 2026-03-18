// src/commands/gaming.js - أوامر الألعاب (30 أمر)

const { handleImposter } = require('../features/imposterGame');
const { getGame, setGame, deleteGame } = require('../database');

// ─── أسئلة الكويز ───
const QUIZ_QUESTIONS = [
    { q: "ما عاصمة مصر؟", a: "القاهرة", choices: ["الإسكندرية", "القاهرة", "الجيزة", "الأقصر"] },
    { q: "ما أطول نهر في العالم؟", a: "النيل", choices: ["الأمازون", "النيل", "المسيسيبي", "الفولغا"] },
    { q: "كم عدد كواكب المجموعة الشمسية؟", a: "8", choices: ["7", "8", "9", "10"] },
    { q: "ما أكبر قارة في العالم؟", a: "آسيا", choices: ["أفريقيا", "آسيا", "أمريكا", "أوروبا"] },
    { q: "من اخترع الهاتف؟", a: "بيل", choices: ["إديسون", "بيل", "نيوتن", "أرشميدس"] },
    { q: "ما عاصمة فرنسا؟", a: "باريس", choices: ["روما", "مدريد", "باريس", "برلين"] },
    { q: "كم عدد أيام السنة الكبيسة؟", a: "366", choices: ["364", "365", "366", "367"] },
    { q: "ما أسرع حيوان بري؟", a: "الفهد", choices: ["الأسد", "الفهد", "الحصان", "الغزال"] },
    { q: "من كتب رواية ألف ليلة وليلة؟", a: "مجهول", choices: ["شكسبير", "مجهول", "نجيب محفوظ", "طه حسين"] },
    { q: "ما أعمق بحر في العالم؟", a: "المحيط الهادئ", choices: ["الأطلسي", "الهندي", "المحيط الهادئ", "البحر الأبيض"] },
];

// ─── أسئلة صح أم كذب ───
const TRUTH_OR_DARE = {
    truth: [
        "ما أكثر شيء تندم عليه في حياتك؟",
        "من أقرب شخص إليك في الجروب؟",
        "ما أغرب شيء فعلته وأنت لوحدك؟",
        "هل سبق وكذبت على أحد في هذا الجروب؟",
        "ما أكثر شيء يزعجك في نفسك؟",
        "ما أكثر اختراع تحب أنه موجود؟",
        "ما أغرب حلم حلمت به؟",
        "لو عندك يوم واحد تعيشه من جديد، ايه هيكون؟",
    ],
    dare: [
        "غيّر اسمك في الجروب لـ 'البطل الأسطوري' لساعة!",
        "ابعث صورة تعبيرية عشوائية من معرضك الآن!",
        "ابعث 'أنا أحب الجميع في هذا الجروب' بالكامل!",
        "اكتب 10 أشياء جميلة عن الشخص فوقك!",
        "غيّر صورة بروفايلك لصورة كوميدية لمدة ساعة!",
        "ابعث صوت صوتي تقول فيه جملة مضحكة!",
        "اكتب كلمة 'أقفشت' 5 مرات متتالية!",
    ]
};

// ─── XO Game ───
function createXOBoard() {
    return Array(9).fill(' ');
}

function renderXOBoard(board) {
    const symbols = board.map((cell, i) => {
        if (cell === 'X') return '❌';
        if (cell === 'O') return '⭕';
        return `${i + 1}️⃣`;
    });
    return `
${symbols[0]} | ${symbols[1]} | ${symbols[2]}
─────────────
${symbols[3]} | ${symbols[4]} | ${symbols[5]}
─────────────
${symbols[6]} | ${symbols[7]} | ${symbols[8]}`.trim();
}

function checkXOWinner(board) {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];
    for (const [a,b,c] of lines) {
        if (board[a] !== ' ' && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    if (board.every(c => c !== ' ')) return 'draw';
    return null;
}

// ─── معالج الألعاب ───
async function handle(ctx) {
    const { command, sock, jid, msg, reply, sender, senderId, isGroup, args, text, mentionedJid } = ctx;

    // ─── لعبة الإمبوستر ───
    if (['امبوستر', 'انا', 'كشف', 'مين', 'خمن', 'نتيجة', 'انهاء'].includes(command)) {
        return await handleImposter(ctx);
    }

    // ─── صح أم كذب ───
    if (['صح_كذب', 'truth', 'dare'].includes(command)) {
        const type = args[0]?.toLowerCase();
        if (type === 'صح' || type === 'truth') {
            const q = TRUTH_OR_DARE.truth[Math.floor(Math.random() * TRUTH_OR_DARE.truth.length)];
            await reply(`🟢 *سؤال صح أم كذب (صح):*\n\n❓ ${q}`);
        } else if (type === 'كذب' || type === 'dare') {
            const d = TRUTH_OR_DARE.dare[Math.floor(Math.random() * TRUTH_OR_DARE.dare.length)];
            await reply(`🔴 *صح أم كذب (كذب):*\n\n🎯 ${d}`);
        } else {
            const rand = Math.random() > 0.5 ? 'truth' : 'dare';
            if (rand === 'truth') {
                const q = TRUTH_OR_DARE.truth[Math.floor(Math.random() * TRUTH_OR_DARE.truth.length)];
                await reply(`🟢 *صح:*\n\n❓ ${q}`);
            } else {
                const d = TRUTH_OR_DARE.dare[Math.floor(Math.random() * TRUTH_OR_DARE.dare.length)];
                await reply(`🔴 *كذب:*\n\n🎯 ${d}`);
            }
        }
        return true;
    }

    // ─── XO Game ───
    if (command === 'xo' || command === 'اكس_او') {
        if (!isGroup) return reply("⚠️ اللعبة في المجموعات فقط.") && true;
        const opponent = mentionedJid[0];
        if (!opponent) return reply("📌 منشن الخصم! مثال: .xo @شخص") && true;
        if (opponent === sender) return reply("😅 لا يمكنك اللعب ضد نفسك!") && true;

        const gameId = `xo_${jid}`;
        setGame(gameId, {
            board: createXOBoard(),
            players: { X: sender, O: opponent },
            turn: 'X',
            type: 'xo'
        });

        await sock.sendMessage(jid, {
            text: `🎮 *بدأت لعبة XO!*\n\n❌ @${senderId} vs ⭕ @${opponent.split('@')[0]}\n\n${renderXOBoard(createXOBoard())}\n\n🎯 دور @${senderId} - اكتب رقماً من 1-9`,
            mentions: [sender, opponent]
        }, { quoted: msg });
        return true;
    }

    // ─── خطوة XO ───
    if (command === 'ضع' || command === 'play') {
        const gameId = `xo_${jid}`;
        const game = getGame(gameId);
        if (!game || game.type !== 'xo') return reply("❓ لا توجد لعبة XO نشطة.") && true;

        const currentPlayer = game.players[game.turn];
        if (sender !== currentPlayer) return reply("⚠️ ليس دورك!") && true;

        const pos = parseInt(args[0]) - 1;
        if (isNaN(pos) || pos < 0 || pos > 8) return reply("📌 اختر رقماً من 1 إلى 9.") && true;
        if (game.board[pos] !== ' ') return reply("❌ هذا المكان محجوز!") && true;

        game.board[pos] = game.turn;
        const winner = checkXOWinner(game.board);

        if (winner) {
            deleteGame(gameId);
            if (winner === 'draw') {
                await reply(`🤝 *تعادل!*\n\n${renderXOBoard(game.board)}`);
            } else {
                const winnerJid = game.players[winner];
                await sock.sendMessage(jid, {
                    text: `🏆 *فاز @${winnerJid.split('@')[0]}!*\n\n${renderXOBoard(game.board)}`,
                    mentions: [winnerJid]
                }, { quoted: msg });
            }
        } else {
            game.turn = game.turn === 'X' ? 'O' : 'X';
            const nextPlayer = game.players[game.turn];
            setGame(gameId, game);
            await sock.sendMessage(jid, {
                text: `${renderXOBoard(game.board)}\n\n🎯 دور @${nextPlayer.split('@')[0]}`,
                mentions: [nextPlayer]
            }, { quoted: msg });
        }
        return true;
    }

    // ─── الكويز ───
    if (command === 'كويز' || command === 'quiz') {
        const q = QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];
        const choices = q.choices.sort(() => Math.random() - 0.5);
        const choiceText = choices.map((c, i) => `${['🅰️','🅱️','🇨','🇩'][i]} ${c}`).join('\n');
        
        const gameId = `quiz_${jid}`;
        setGame(gameId, { answer: q.a, askedAt: Date.now(), type: 'quiz' });

        await reply(`
🧠 *سؤال الكويز!*

❓ ${q.q}

${choiceText}

⏱️ الإجابة خلال 30 ثانية!
اكتب *.اجابة [رقم/نص]*`.trim());

        // إنهاء الكويز تلقائياً
        setTimeout(async () => {
            const g = getGame(gameId);
            if (g && g.type === 'quiz') {
                deleteGame(gameId);
                await sock.sendMessage(jid, { text: `⏰ انتهى الوقت!\n✅ الإجابة الصحيحة: *${q.a}*` });
            }
        }, 30000);
        return true;
    }

    // ─── إجابة الكويز ───
    if (command === 'اجابة' || command === 'answer') {
        const gameId = `quiz_${jid}`;
        const game = getGame(gameId);
        if (!game || game.type !== 'quiz') return true;

        const userAnswer = text.trim();
        if (userAnswer.toLowerCase().includes(game.answer.toLowerCase()) || game.answer.toLowerCase().includes(userAnswer.toLowerCase())) {
            deleteGame(gameId);
            await reply(`🎉 *صحيح!* @${senderId} أجاب بشكل صحيح!\n✅ الإجابة: *${game.answer}*\n🏆 +10 نقاط!`, { mentions: [sender] });
        } else {
            await reply(`❌ خطأ! حاول مرة أخرى...`);
        }
        return true;
    }

    // ─── 🎲 نرد عشوائي ───
    if (command === 'نرد' || command === 'dice') {
        const num = Math.floor(Math.random() * 6) + 1;
        const dices = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];
        await reply(`🎲 رميت النرد!\n\n${dices[num - 1]} *${num}*`);
        return true;
    }

    // ─── قلاب العملة ───
    if (command === 'عملة' || command === 'flip') {
        const result = Math.random() > 0.5 ? '🪙 وجه' : '🪙 كتابة';
        await reply(`🪙 *قلاب العملة!*\n\nالنتيجة: *${result}*`);
        return true;
    }

    // ─── لعبة الأرقام (8-ball) ───
    if (command === 'تنبؤ' || command === '8ball') {
        const answers = [
            '✅ نعم بالتأكيد!', '🟢 الأمور واعدة!', '🔮 كما أرى، نعم.',
            '🌟 الإشارات تقول نعم.', '🤔 ليس واضحاً الآن.',
            '😐 أعد السؤال لاحقاً.', '🔴 لا أعتقد ذلك.', '❌ بالتأكيد لا.'
        ];
        const ans = answers[Math.floor(Math.random() * answers.length)];
        await reply(`🎱 *الكرة السحرية تقول:*\n\n${ans}`);
        return true;
    }

    // ─── اختار شخص عشوائي ───
    if (command === 'عشوائي' || command === 'random') {
        if (!isGroup) return reply("⚠️ للمجموعات فقط.") && true;
        const groupMeta = await sock.groupMetadata(jid);
        const members = groupMeta.participants;
        const chosen = members[Math.floor(Math.random() * members.length)];
        await sock.sendMessage(jid, {
            text: `🎯 *الاختيار العشوائي!*\n\n🏆 الفائز هو: @${chosen.id.split('@')[0]}`,
            mentions: [chosen.id]
        }, { quoted: msg });
        return true;
    }

    return false;
}

module.exports = { handle };
