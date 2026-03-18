const config = require('./config');
const { addXP, getGroup } = require('./database');

const adminCmds = require('./commands/admin');
const gamingCmds = require('./commands/gaming');
const toolsCmds = require('./commands/tools');
const islamicCmds = require('./commands/islamic');
const settingsCmds = require('./commands/settings');
const funCmds = require('./commands/fun');
const extraCmds = require('./commands/extra');
const extra2Cmds = require('./commands/extra2');
const { askGemini } = require('./features/gemini');

const BAD_WORDS = [
    'احا', 'أحا', 'خول', 'شرموط', 'شرموطة', 'متناك', 'متناكة', 'كس', 'كسم', 'كسمك',
    'زب', 'زبي', 'طيز', 'عرص', 'معرص', 'ابن متناكة', 'ابن وسخة', 'يلعن', 'تفو',
    'fuck', 'fucking', 'shit', 'bitch', 'motherfucker', 'asshole', 'slut', 'whore'
];

function normalizeJidUser(jid = '') {
    return jid.split('@')[0].split(':')[0];
}

function containsBadWords(text = '') {
    const normalizedText = text.toLowerCase();
    return BAD_WORDS.some(word => normalizedText.includes(word.toLowerCase()));
}

function participantMatchesJid(participant, jid = '') {
    const normalized = normalizeJidUser(jid);
    return [
        participant?.id,
        participant?.lid,
        participant?.phoneNumber
    ].some(value => normalizeJidUser(value) === normalized);
}

function buildDeleteKey(msg) {
    return {
        remoteJid: msg.key.remoteJid,
        fromMe: msg.key.fromMe,
        id: msg.key.id,
        participant: msg.key.participantAlt || msg.key.participant
    };
}

function unwrapMessageContainer(message = {}) {
    let current = message;
    let safety = 0;

    while (current && safety < 10) {
        safety += 1;

        if (current.ephemeralMessage) {
            current = current.ephemeralMessage.message;
            continue;
        }

        if (current.viewOnceMessage) {
            current = current.viewOnceMessage.message;
            continue;
        }

        if (current.viewOnceMessageV2) {
            current = current.viewOnceMessageV2.message;
            continue;
        }

        if (current.viewOnceMessageV2Extension) {
            current = current.viewOnceMessageV2Extension.message;
            continue;
        }

        if (current.documentWithCaptionMessage) {
            current = current.documentWithCaptionMessage.message;
            continue;
        }

        break;
    }

    return current || {};
}

function getPrimaryMessageNode(message = {}) {
    const normalized = unwrapMessageContainer(message);
    const type = Object.keys(normalized)[0] || '';
    return {
        normalized,
        type,
        node: normalized[type] || {}
    };
}

function getMessageBody(message = {}) {
    const { type, node } = getPrimaryMessageNode(message);

    if (type === 'conversation') return message.conversation || '';
    if (type === 'extendedTextMessage') return node.text || '';
    if (type === 'imageMessage') return node.caption || '';
    if (type === 'videoMessage') return node.caption || '';
    if (type === 'documentMessage') return node.caption || '';
    if (type === 'buttonsResponseMessage') return node.selectedDisplayText || node.selectedButtonId || '';
    if (type === 'listResponseMessage') return node.title || node.singleSelectReply?.selectedRowId || '';
    if (type === 'templateButtonReplyMessage') return node.selectedDisplayText || node.selectedId || '';
    if (type === 'interactiveResponseMessage') return node?.nativeFlowResponseMessage?.paramsJson || '';

    return '';
}

function getContextInfo(message = {}) {
    const { node } = getPrimaryMessageNode(message);
    return node.contextInfo || {};
}

function extractMessageInfo(sock, msg) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    const sender = isGroup
        ? (msg.key.participantAlt || msg.key.participant)
        : (msg.key.remoteJidAlt || jid);
    const senderId = normalizeJidUser(sender);
    const normalizedMessage = unwrapMessageContainer(msg.message || {});
    const type = Object.keys(normalizedMessage)[0] || '';
    const body = getMessageBody(normalizedMessage).trim();
    const contextInfo = getContextInfo(normalizedMessage);
    const quoted = contextInfo.quotedMessage;
    const quotedSender = contextInfo.participant;
    const mentionedJid = contextInfo.mentionedJid || [];
    const isOwner = config.OWNERS.includes(senderId);
    const prefix = config.PREFIX;
    const isCommand = body.startsWith(prefix);

    let command = '';
    let args = [];
    let text = '';

    if (isCommand) {
        const parts = body.slice(prefix.length).trim().split(/\s+/);
        command = parts[0]?.toLowerCase() || '';
        args = parts.slice(1);
        text = args.join(' ');
    }

    return {
        jid,
        isGroup,
        sender,
        senderId,
        isOwner,
        body,
        type,
        command,
        args,
        text,
        prefix,
        isCommand,
        quoted,
        quotedSender,
        mentionedJid,
        msg,
        messageContent: normalizedMessage,
        contextInfo
    };
}

function createReply(sock, jid, msg) {
    return async (text, options = {}) => {
        return sock.sendMessage(jid, { text, ...options }, { quoted: msg });
    };
}

async function handleMessage(sock, msg, store) {
    try {
        const info = extractMessageInfo(sock, msg);
        const { jid, isGroup, sender, senderId, isOwner, body, command, isCommand } = info;

        if (!body) return;

        const reply = createReply(sock, jid, msg);

        if (isGroup) {
            const xpResult = addXP(sender);
            if (xpResult.levelUp) {
                await sock.sendMessage(jid, {
                    text: `🎉 تهانينا @${senderId}!\nوصلت للمستوى ${xpResult.newLevel}! 🏆`,
                    mentions: [sender]
                });
            }

            const groupSettings = getGroup(jid);

            if (groupSettings.antilink && !isOwner) {
                const linkRegex = /(https?:\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+)/gi;
                if (linkRegex.test(body)) {
                    await sock.sendMessage(jid, { delete: buildDeleteKey(msg) });
                    await reply(`⛔ @${senderId} تم حذف رسالتك لاحتوائها على رابط!`, {
                        mentions: [sender]
                    });
                    return;
                }
            }

            if (groupSettings.badwords && containsBadWords(body)) {
                await sock.sendMessage(jid, { delete: buildDeleteKey(msg) });
                return;
            }
        }

        if (isOwner) {
            const reactions = config.OWNER_REACTIONS;
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            await sock.sendMessage(jid, { react: { text: randomReaction, key: msg.key } });
        }

        if (isCommand) {
            let isAdmin = false;
            let isBotAdmin = false;

            if (isGroup) {
                try {
                    const groupMeta = await sock.groupMetadata(jid);
                    const participants = groupMeta.participants;
                    const senderParticipant = participants.find(p => participantMatchesJid(p, sender));
                    const botParticipant = participants.find(
                        p => participantMatchesJid(p, sock.user?.id)
                    );

                    isAdmin = Boolean(senderParticipant?.admin);
                    isBotAdmin = Boolean(botParticipant?.admin);
                } catch {
                    // ignore metadata errors
                }
            }

            const ctx = { ...info, reply, isAdmin, isBotAdmin, sock, store };

            if (await adminCmds.handle(ctx)) return;
            if (await gamingCmds.handle(ctx)) return;
            if (await toolsCmds.handle(ctx)) return;
            if (await islamicCmds.handle(ctx)) return;
            if (await settingsCmds.handle(ctx)) return;
            if (await funCmds.handle(ctx)) return;
            if (await extraCmds.handle(ctx)) return;
            if (await extra2Cmds.handle(ctx)) return;

            if (['help', 'مساعدة', 'menu', 'قائمة'].includes(command)) {
                await sendMenu(sock, jid, msg);
                return;
            }

            await reply(`❓ أمر غير موجود: *${command}*\nاستخدم *.help* لعرض القائمة الكاملة`);
            return;
        }

        if (isGroup) {
            const botNumber = normalizeJidUser(sock.user?.id);
            if (body.includes(`@${botNumber}`) || body.toLowerCase().includes('ياربوت') || body.includes('يا بوت')) {
                const question = body
                    .replace(`@${botNumber}`, '')
                    .replace('ياربوت', '')
                    .replace('يا بوت', '')
                    .trim();

                if (question) {
                    await sock.sendMessage(jid, { react: { text: '🤖', key: msg.key } });
                    const answer = await askGemini(question);
                    await reply(`🤖 *${config.BOT_NAME}:*\n\n${answer}`);
                }
            }
        }
    } catch (err) {
        console.error('❌ خطأ في handler:', err.message);
    }
}

async function sendMenu(sock, jid, msg) {
    const menuText = `
🤖 ${config.BOT_NAME}

👑 إدارة: .طرد .ترقية .تنزيل .وسم .كتم .فتح .تحذير .رابط
⚙️ إعدادات: .ترحيب .وداع .انتيلينك .فلتر_شتايم .حالة
🎮 ألعاب: .امبوستر .xo .كويز
🛠️ أدوات: .سؤال .ترجمة .تلخيص .طقس
🕌 إسلامي: .آية .سورة .اذكار .حديث
🎉 ترفيه: .بحبك .مزاج .برج .نكتة

⌨️ البادئة: *${config.PREFIX}*
    `.trim();

    await sock.sendMessage(jid, { text: menuText }, { quoted: msg });
}

module.exports = { handleMessage };
