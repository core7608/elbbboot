const { setGroupSetting, getGroup } = require('../database');
const config = require('../config');

async function handle(ctx) {
    const { command, sock, jid, msg, reply, sender, isOwner, isAdmin, isGroup, args, text } = ctx;

    const checkAdmin = async () => {
        if (!isGroup) {
            await reply('⚠️ للمجموعات فقط.');
            return false;
        }
        if (!isAdmin && !isOwner) {
            await reply('⛔ للمسؤولين فقط.');
            return false;
        }
        return true;
    };

    if (['ترحيب', 'welcome'].includes(command)) {
        if (!await checkAdmin()) return true;
        const action = args[0];
        if (action === 'تشغيل' || action === 'on') {
            setGroupSetting(jid, 'welcome', true);
            await reply('✅ تم تفعيل رسالة الترحيب!');
        } else if (action === 'اطفاء' || action === 'off') {
            setGroupSetting(jid, 'welcome', false);
            await reply('🔴 تم تعطيل رسالة الترحيب.');
        } else {
            const setting = getGroup(jid).welcome;
            await reply(`👋 الترحيب: ${setting ? '✅ مفعّل' : '❌ معطّل'}\nللتغيير: .ترحيب تشغيل/اطفاء`);
        }
        return true;
    }

    if (['وداع', 'goodbye', 'bye'].includes(command)) {
        if (!await checkAdmin()) return true;
        const action = args[0];
        if (action === 'تشغيل' || action === 'on') {
            setGroupSetting(jid, 'goodbye', true);
            await reply('✅ تم تفعيل رسالة الوداع!');
        } else if (action === 'اطفاء' || action === 'off') {
            setGroupSetting(jid, 'goodbye', false);
            await reply('🔴 تم تعطيل رسالة الوداع.');
        } else {
            const setting = getGroup(jid).goodbye;
            await reply(`🚪 الوداع: ${setting ? '✅ مفعّل' : '❌ معطّل'}\nللتغيير: .وداع تشغيل/اطفاء`);
        }
        return true;
    }

    if (['انتيلينك', 'antilink', 'حماية_لينكات'].includes(command)) {
        if (!await checkAdmin()) return true;
        const action = args[0];
        if (action === 'تشغيل' || action === 'on') {
            setGroupSetting(jid, 'antilink', true);
            await reply('✅ تم تفعيل حماية اللينكات. أي رابط سيتم حذفه تلقائيًا.');
        } else if (action === 'اطفاء' || action === 'off') {
            setGroupSetting(jid, 'antilink', false);
            await reply('🔴 تم تعطيل حماية اللينكات.');
        } else {
            const setting = getGroup(jid).antilink;
            await reply(`🔗 حماية اللينكات: ${setting ? '✅ مفعّلة' : '❌ معطّلة'}\nللتغيير: .انتيلينك تشغيل/اطفاء`);
        }
        return true;
    }

    if (['فلتر_شتايم', 'badwords', 'profanity'].includes(command)) {
        if (!await checkAdmin()) return true;
        const action = args[0];
        if (action === 'تشغيل' || action === 'on') {
            setGroupSetting(jid, 'badwords', true);
            await reply('✅ تم تفعيل فلتر الشتائم. أي رسالة تحتوي ألفاظًا محظورة سيتم حذفها تلقائيًا.');
        } else if (action === 'اطفاء' || action === 'off') {
            setGroupSetting(jid, 'badwords', false);
            await reply('🔴 تم تعطيل فلتر الشتائم.');
        } else {
            const setting = getGroup(jid).badwords;
            await reply(`🧹 فلتر الشتائم: ${setting ? '✅ مفعّل' : '❌ معطّل'}\nللتغيير: .فلتر_شتايم تشغيل/اطفاء`);
        }
        return true;
    }

    if (['رسالة_ترحيب', 'setwelcome'].includes(command)) {
        if (!await checkAdmin()) return true;
        if (!text) return reply('📌 مثال: .رسالة_ترحيب مرحبًا بك يا {name}!\n\nالمتغيرات: {name} {group}') && true;
        setGroupSetting(jid, 'welcomeMsg', text);
        await reply(`✅ تم تعيين رسالة الترحيب:\n\n${text}`);
        return true;
    }

    if (['رسالة_وداع', 'setgoodbye'].includes(command)) {
        if (!await checkAdmin()) return true;
        if (!text) return reply('📌 مثال: .رسالة_وداع وداعًا {name}!') && true;
        setGroupSetting(jid, 'goodbyeMsg', text);
        await reply(`✅ تم تعيين رسالة الوداع:\n\n${text}`);
        return true;
    }

    if (['حالة', 'group_status'].includes(command)) {
        if (!isGroup) return reply('⚠️ للمجموعات فقط.') && true;
        const settings = getGroup(jid);
        await reply(`
⚙️ *إعدادات المجموعة:*

👋 الترحيب: ${settings.welcome ? '✅' : '❌'}
🚪 الوداع: ${settings.goodbye ? '✅' : '❌'}
🔗 حماية اللينكات: ${settings.antilink ? '✅' : '❌'}
🧹 فلتر الشتائم: ${settings.badwords ? '✅' : '❌'}
🔇 الكتم: ${settings.muted ? '✅' : '❌'}
        `.trim());
        return true;
    }

    if (['حالة_بوت', 'set_status'].includes(command) && isOwner) {
        if (!text) return reply('📌 اكتب الحالة: .حالة_بوت [النص]') && true;
        try {
            await sock.updateProfileStatus(text);
            await reply(`✅ تم تغيير الحالة إلى: ${text}`);
        } catch {
            await reply('❌ فشل في تغيير الحالة.');
        }
        return true;
    }

    if (['اسم_بوت', 'set_botname'].includes(command) && isOwner) {
        if (!text) return reply('📌 اكتب الاسم الجديد.') && true;
        try {
            await sock.updateProfileName(text);
            await reply(`✅ تم تغيير اسم البوت إلى: ${text}`);
        } catch {
            await reply('❌ فشل في تغيير الاسم.');
        }
        return true;
    }

    if (['معلومات_بوت', 'botinfo'].includes(command)) {
        const botId = sock.user?.id?.split(':')[0];
        await reply(`
🤖 *معلومات البوت:*

📛 الاسم: ${config.BOT_NAME}
📞 الرقم: ${botId}
👑 الأدمنية: ${config.OWNERS.join(', ')}
⌨️ البادئة: ${config.PREFIX}
📦 الإصدار: v2.0
🛠️ المطور: ElAawady
        `.trim());
        return true;
    }

    if (['خاص', 'private_mode'].includes(command) && isOwner) {
        await reply('✅ وضع الخاص: رسائل البوت للأدمن فقط.\n(هذه ميزة يمكن تطويرها حسب الحاجة)');
        return true;
    }

    if (['بادئة', 'setprefix'].includes(command) && isOwner) {
        if (!text) return reply(`📌 البادئة الحالية: ${config.PREFIX}\nمثال: .بادئة !`) && true;
        config.PREFIX = text[0];
        await reply(`✅ تم تغيير البادئة إلى: *${text[0]}*\n⚠️ يجب إعادة التشغيل لحفظ التغيير.`);
        return true;
    }

    if (['مشرفين', 'owners'].includes(command)) {
        const ownerList = config.OWNERS.map(o => `👑 +${o}`).join('\n');
        await reply(`👑 *مشرفو البوت:*\n\n${ownerList}`);
        return true;
    }

    if (['تعطيل', 'disable_cmds'].includes(command)) {
        if (!await checkAdmin()) return true;
        setGroupSetting(jid, 'disabled', true);
        await reply('🔴 تم تعطيل الأوامر في هذه المجموعة.\nاستخدم .تفعيل لإعادة التفعيل.');
        return true;
    }

    if (['تفعيل', 'enable_cmds'].includes(command)) {
        if (!await checkAdmin()) return true;
        setGroupSetting(jid, 'disabled', false);
        await reply('✅ تم تفعيل الأوامر في هذه المجموعة.');
        return true;
    }

    if (['صورة', 'avatar', 'pp'].includes(command)) {
        const target = ctx.mentionedJid[0] || sender;
        try {
            const ppUrl = await sock.profilePictureUrl(target, 'image');
            await sock.sendMessage(jid, {
                image: { url: ppUrl },
                caption: `📸 صورة @${target.split('@')[0]}`,
                mentions: [target]
            }, { quoted: msg });
        } catch {
            await reply('❌ الشخص يخفي صورته أو لا توجد له صورة.');
        }
        return true;
    }

    return false;
}

module.exports = { handle };
