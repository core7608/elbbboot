// src/features/welcome.js - نظام الترحيب والوداع

const { getGroup } = require('../database');

function resolveParticipantJid(participant) {
    if (typeof participant === 'string') {
        return participant;
    }

    return participant?.id || participant?.lid || participant?.phoneNumber || '';
}

async function welcomeGoodbye(sock, update) {
    const { id, participants, action } = update;
    const settings = getGroup(id);
    const metadata = await sock.groupMetadata(id).catch(() => null);
    const groupName = metadata?.subject || 'المجموعة';

    for (const participant of participants) {
        const participantJid = resolveParticipantJid(participant);

        if (!participantJid) {
            continue;
        }

        const userId = participantJid.split('@')[0].split(':')[0];

        if (action === 'add' && settings.welcome) {
            let welcomeMsg = settings.welcomeMsg;
            
            if (!welcomeMsg) {
                welcomeMsg = `
╔══════════════════════════╗
║    🎉 أهلاً وسهلاً! 🎉    ║
╚══════════════════════════╝

مرحباً @${userId} 👋

✨ نحن سعداء بانضمامك إلينا!
📌 الرجاء قراءة القواعد والتقيّد بها.
💬 لا تتردد في التعارف!

━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 البوت تلقائي | ElAawady Bot
                `.trim();
            } else {
                welcomeMsg = welcomeMsg
                    .replace('{name}', `@${userId}`)
                    .replace('{group}', groupName);
            }

            try {
                const ppUrl = await sock.profilePictureUrl(participantJid, 'image').catch(() => null);
                
                if (ppUrl) {
                    await sock.sendMessage(id, {
                        image: { url: ppUrl },
                        caption: welcomeMsg,
                        mentions: [participantJid]
                    });
                } else {
                    await sock.sendMessage(id, {
                        text: welcomeMsg,
                        mentions: [participantJid]
                    });
                }
            } catch (e) {
                await sock.sendMessage(id, {
                    text: welcomeMsg,
                    mentions: [participantJid]
                });
            }

        } else if (action === 'remove' && settings.goodbye) {
            let goodbyeMsg = settings.goodbyeMsg;
            
            if (!goodbyeMsg) {
                goodbyeMsg = `
👋 *وداعاً @${userId}*

أتمنى أن يكون وقتك معنا كان جميلاً
إلى اللقاء في مكان آخر! 🌟

━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 ElAawady Bot
                `.trim();
            } else {
                goodbyeMsg = goodbyeMsg
                    .replace('{name}', `@${userId}`)
                    .replace('{group}', groupName);
            }

            await sock.sendMessage(id, {
                text: goodbyeMsg,
                mentions: [participantJid]
            });
        }
    }
}

module.exports = { welcomeGoodbye };
