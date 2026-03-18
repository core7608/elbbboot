const fs = require('fs');
const path = require('path');
const { getWarnings, addWarning, clearWarnings, setGroupSetting } = require('../database');
const config = require('../config');

function normalizeJidUser(jid = '') {
    return jid.split('@')[0].split(':')[0];
}

async function handle(ctx) {
    const {
        command,
        sock,
        jid,
        msg,
        reply,
        sender,
        senderId,
        isOwner,
        isAdmin,
        isBotAdmin,
        isGroup,
        args,
        text,
        mentionedJid,
        quotedSender,
        contextInfo
    } = ctx;

    const checkAdmin = async () => {
        if (!isGroup) {
            await reply('⚠️ هذا الأمر يعمل في المجموعات فقط.');
            return false;
        }
        if (!isBotAdmin) {
            await reply('❌ يجب أن أكون Admin أولًا.');
            return false;
        }
        if (!isAdmin && !isOwner) {
            await reply('⛔ هذا الأمر للمسؤولين فقط.');
            return false;
        }
        return true;
    };

    const getGroupMeta = async () => sock.groupMetadata(jid);

    const resolveLidToPn = (target) => {
        if (!target || !target.endsWith('@lid')) return null;
        const lid = normalizeJidUser(target);
        const reversePath = path.join(process.cwd(), 'auth_info', `lid-mapping-${lid}_reverse.json`);

        if (!fs.existsSync(reversePath)) return null;

        try {
            const pn = JSON.parse(fs.readFileSync(reversePath, 'utf8'));
            return pn ? `${pn}@s.whatsapp.net` : null;
        } catch {
            return null;
        }
    };

    const resolveTargetJid = async (target) => {
        if (!target) return null;

        const normalizedTarget = normalizeJidUser(target);
        const groupMeta = await getGroupMeta();
        const participant = groupMeta.participants.find(p =>
            normalizeJidUser(p.id) === normalizedTarget ||
            normalizeJidUser(p.lid) === normalizedTarget ||
            normalizeJidUser(p.phoneNumber) === normalizedTarget
        );

        if (participant?.phoneNumber) return participant.phoneNumber;
        if (participant?.id) return participant.id;

        if (contextInfo?.participantAlt && quotedSender && normalizeJidUser(quotedSender) === normalizedTarget) {
            return contextInfo.participantAlt;
        }

        return resolveLidToPn(target) || target;
    };

    const getTarget = async () => {
        const rawTarget = quotedSender || mentionedJid[0] || null;
        return resolveTargetJid(rawTarget);
    };

    const isParticipantInGroup = async (target) => {
        const groupMeta = await getGroupMeta();
        return groupMeta.participants.some(p =>
            normalizeJidUser(p.id) === normalizeJidUser(target) ||
            normalizeJidUser(p.lid) === normalizeJidUser(target) ||
            normalizeJidUser(p.phoneNumber) === normalizeJidUser(target)
        );
    };

    const runAdminAction = async (action, target, successText) => {
        try {
            await sock.groupParticipantsUpdate(jid, [target], action);
            await reply(successText, { mentions: [target] });
        } catch (err) {
            await reply(`❌ فشل تنفيذ الأمر: ${err.message}`);
        }
    };

    if (['طرد', 'kick'].includes(command)) {
        if (!await checkAdmin()) return true;
        const target = await getTarget();
        if (!target) return reply('📌 منشن الشخص أو رد على رسالته.') && true;
        if (normalizeJidUser(target) === senderId) return reply('⚠️ لا يمكنك طرد نفسك.') && true;
        if (normalizeJidUser(target) === normalizeJidUser(sock.user?.id)) return reply('⚠️ لا يمكنني طرد نفسي.') && true;
        if (config.OWNERS.includes(normalizeJidUser(target))) return reply('🛡️ لا يمكن طرد أحد المالكين.') && true;
        if (!await isParticipantInGroup(target)) return reply('⚠️ هذا العضو غير موجود في المجموعة.') && true;
        await runAdminAction('remove', target, `✅ تم طرد @${normalizeJidUser(target)} بنجاح!`);
        return true;
    }

    if (['اضف', 'add'].includes(command)) {
        if (!await checkAdmin()) return true;
        const number = args[0]?.replace(/[^0-9]/g, '');
        if (!number) return reply('📌 اكتب رقم الهاتف بعد الأمر.') && true;

        try {
            await sock.groupParticipantsUpdate(jid, [`${number}@s.whatsapp.net`], 'add');
            await reply(`✅ تمت إضافة ${number} للمجموعة.`);
        } catch (err) {
            await reply(`❌ فشلت الإضافة: ${err.message}`);
        }
        return true;
    }

    if (['ترقية', 'promote'].includes(command)) {
        if (!await checkAdmin()) return true;
        const target = await getTarget();
        if (!target) return reply('📌 منشن الشخص أو رد على رسالته.') && true;
        if (!await isParticipantInGroup(target)) return reply('⚠️ هذا العضو غير موجود في المجموعة.') && true;
        await runAdminAction('promote', target, `⬆️ تم ترقية @${normalizeJidUser(target)} إلى مسؤول!`);
        return true;
    }

    if (['تنزيل', 'demote'].includes(command)) {
        if (!await checkAdmin()) return true;
        const target = await getTarget();
        if (!target) return reply('📌 منشن الشخص أو رد على رسالته.') && true;
        if (!await isParticipantInGroup(target)) return reply('⚠️ هذا العضو غير موجود في المجموعة.') && true;
        await runAdminAction('demote', target, `⬇️ تم تنزيل @${normalizeJidUser(target)} من الإدارة.`);
        return true;
    }

    if (['وسم', 'tagall', 'الكل'].includes(command)) {
        if (!await checkAdmin()) return true;
        const groupMeta = await getGroupMeta();
        const mentions = groupMeta.participants.map(m => m.phoneNumber || m.id);
        const tagText = mentions.map(m => `@${normalizeJidUser(m)}`).join(' ');
        const message = text || '📢 تنبيه للجميع!';
        await sock.sendMessage(jid, { text: `${message}\n\n${tagText}`, mentions }, { quoted: msg });
        return true;
    }

    if (['كتم', 'mute'].includes(command)) {
        if (!await checkAdmin()) return true;
        try {
            await sock.groupSettingUpdate(jid, 'announcement');
            setGroupSetting(jid, 'muted', true);
            await reply('🔇 تم كتم المجموعة.');
        } catch (err) {
            await reply(`❌ فشل كتم المجموعة: ${err.message}`);
        }
        return true;
    }

    if (['فتح', 'unmute', 'تحرير', 'open'].includes(command)) {
        if (!await checkAdmin()) return true;
        try {
            await sock.groupSettingUpdate(jid, 'not_announcement');
            setGroupSetting(jid, 'muted', false);
            await reply('🔓 تم فتح المجموعة للجميع.');
        } catch (err) {
            await reply(`❌ فشل فتح المجموعة: ${err.message}`);
        }
        return true;
    }

    if (['قفل', 'lock'].includes(command)) {
        if (!await checkAdmin()) return true;
        try {
            await sock.groupSettingUpdate(jid, 'locked');
            await reply('🔒 تم قفل إعدادات المجموعة.');
        } catch (err) {
            await reply(`❌ فشل قفل الإعدادات: ${err.message}`);
        }
        return true;
    }

    if (['فك_قفل', 'unlock'].includes(command)) {
        if (!await checkAdmin()) return true;
        try {
            await sock.groupSettingUpdate(jid, 'unlocked');
            await reply('🔓 تم فك قفل إعدادات المجموعة.');
        } catch (err) {
            await reply(`❌ فشل فك القفل: ${err.message}`);
        }
        return true;
    }

    if (['تحذير', 'warn'].includes(command)) {
        if (!await checkAdmin()) return true;
        const target = await getTarget();
        if (!target) return reply('📌 منشن الشخص أو رد على رسالته.') && true;

        const warns = addWarning(jid, normalizeJidUser(target));
        await reply(`⚠️ تحذير #${warns} لـ @${normalizeJidUser(target)}`, { mentions: [target] });

        if (warns >= 3) {
            await runAdminAction('remove', target, `🚫 تم طرد @${normalizeJidUser(target)} بعد 3 تحذيرات!`);
            clearWarnings(jid, normalizeJidUser(target));
        }
        return true;
    }

    if (['مسح_تحذيرات', 'clearwarn'].includes(command)) {
        if (!await checkAdmin()) return true;
        const target = await getTarget();
        if (!target) return reply('📌 منشن الشخص أو رد على رسالته.') && true;
        clearWarnings(jid, normalizeJidUser(target));
        await reply(`✅ تم مسح تحذيرات @${normalizeJidUser(target)}`, { mentions: [target] });
        return true;
    }

    if (['تحذيرات', 'warns'].includes(command)) {
        const target = await resolveTargetJid(quotedSender || mentionedJid[0] || sender);
        const warns = getWarnings(jid, normalizeJidUser(target));
        await reply(`📊 تحذيرات @${normalizeJidUser(target)}: ${warns}/3`, { mentions: [target] });
        return true;
    }

    if (['معلومات', 'groupinfo', 'info'].includes(command)) {
        if (!isGroup) return reply('⚠️ هذا الأمر للمجموعات فقط.') && true;
        const groupMeta = await getGroupMeta();
        await reply(`
📋 *معلومات المجموعة*

📌 الاسم: ${groupMeta.subject}
👥 الأعضاء: ${groupMeta.participants.length}
👑 المسؤولون: ${groupMeta.participants.filter(p => p.admin).length}
🆔 المعرف: ${jid}
        `.trim());
        return true;
    }

    if (['تغيير_اسم', 'setname'].includes(command)) {
        if (!await checkAdmin()) return true;
        if (!text) return reply('📌 اكتب الاسم الجديد بعد الأمر.') && true;
        try {
            await sock.groupUpdateSubject(jid, text);
            await reply(`✅ تم تغيير اسم المجموعة إلى: ${text}`);
        } catch (err) {
            await reply(`❌ فشل تغيير الاسم: ${err.message}`);
        }
        return true;
    }

    if (['تغيير_وصف', 'setdesc'].includes(command)) {
        if (!await checkAdmin()) return true;
        if (!text) return reply('📌 اكتب الوصف الجديد بعد الأمر.') && true;
        try {
            await sock.groupUpdateDescription(jid, text);
            await reply('✅ تم تغيير وصف المجموعة.');
        } catch (err) {
            await reply(`❌ فشل تغيير الوصف: ${err.message}`);
        }
        return true;
    }

    if (['رابط', 'link'].includes(command)) {
        if (!await checkAdmin()) return true;
        try {
            const code = await sock.groupInviteCode(jid);
            await reply(`🔗 رابط المجموعة:\nhttps://chat.whatsapp.com/${code}`);
        } catch (err) {
            await reply(`❌ فشل جلب الرابط: ${err.message}`);
        }
        return true;
    }

    if (['رابط_جديد', 'resetlink'].includes(command)) {
        if (!await checkAdmin()) return true;
        try {
            await sock.groupRevokeInvite(jid);
            const code = await sock.groupInviteCode(jid);
            await reply(`🔄 تم إعادة ضبط الرابط:\nhttps://chat.whatsapp.com/${code}`);
        } catch (err) {
            await reply(`❌ فشل إعادة ضبط الرابط: ${err.message}`);
        }
        return true;
    }

    if (['مسح', 'delete', 'del'].includes(command)) {
        if (!await checkAdmin()) return true;
        const quotedCtx = contextInfo;
        if (!quotedCtx?.stanzaId) return reply('📌 رد على الرسالة التي تريد مسحها.') && true;

        try {
            await sock.sendMessage(jid, {
                delete: {
                    remoteJid: jid,
                    fromMe: false,
                    id: quotedCtx.stanzaId,
                    participant: quotedCtx.participantAlt || quotedCtx.participant
                }
            });
        } catch (err) {
            await reply(`❌ فشل حذف الرسالة: ${err.message}`);
        }
        return true;
    }

    if (['اسكت', 'silence'].includes(command)) {
        if (!await checkAdmin()) return true;
        const target = await getTarget();
        if (!target) return reply('📌 منشن الشخص أو رد على رسالته.') && true;
        if (!await isParticipantInGroup(target)) return reply('⚠️ هذا العضو غير موجود في المجموعة.') && true;
        await runAdminAction('demote', target, `🔇 تم تنزيل @${normalizeJidUser(target)} من الإدارة.`);
        return true;
    }

    if (['ادمنية', 'admins'].includes(command)) {
        if (!isGroup) return reply('⚠️ للمجموعات فقط.') && true;
        const groupMeta = await getGroupMeta();
        const admins = groupMeta.participants.filter(p => p.admin);
        const mentions = admins.map(a => a.phoneNumber || a.id);
        const list = mentions.map(a => `👑 @${normalizeJidUser(a)}`).join('\n');
        await sock.sendMessage(jid, { text: `👑 *مسؤولو المجموعة:*\n\n${list}`, mentions }, { quoted: msg });
        return true;
    }

    if (['اعضاء', 'members'].includes(command)) {
        if (!isGroup) return reply('⚠️ للمجموعات فقط.') && true;
        const groupMeta = await getGroupMeta();
        await reply(`👥 عدد أعضاء المجموعة: ${groupMeta.participants.length}\n👑 منهم مسؤولون: ${groupMeta.participants.filter(m => m.admin).length}`);
        return true;
    }

    if (['ping', 'بينغ'].includes(command)) {
        const start = Date.now();
        await reply(`🏓 Pong! السرعة: ${Date.now() - start}ms`);
        return true;
    }

    if (['restart', 'اعادة'].includes(command) && isOwner) {
        await reply('🔄 جاري إعادة التشغيل...');
        process.exit(0);
    }

    if (['status', 'حالة_بوت'].includes(command)) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        await reply(`
📊 *حالة البوت*

⏱️ وقت التشغيل: ${hours}h ${mins}m
💾 الذاكرة المستخدمة: ${used.toFixed(2)} MB
🟢 الحالة: نشط
        `.trim());
        return true;
    }

    return false;
}

module.exports = { handle };
