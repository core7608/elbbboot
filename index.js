require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const { handleMessage } = require('./src/handler');
const { initDB } = require('./src/database');
const config = require('./src/config');

const dirs = ['./auth_info', './temp', './data', './logs'];
const lockFile = './temp/bot.lock';
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const store = {
    chats: new Map(),
    messages: new Map(),
    contacts: new Map(),
    bind: () => console.log('Store bound to events'),
    loadMessage: async () => null
};

let activeSock = null;
let reconnectTimer = null;
let isStarting = false;
let lockHandle = null;

function logBanner(version) {
    console.log('\n====================================');
    console.log(`Bot starting: ${config.BOT_NAME}`);
    console.log(`Baileys Version: ${version.join('.')}`);
    console.log('====================================\n');
}

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

function acquireSingleInstanceLock() {
    try {
        lockHandle = fs.openSync(lockFile, 'wx');
        fs.writeFileSync(lockHandle, String(process.pid));
    } catch (err) {
        if (err.code === 'EEXIST') {
            console.error('هناك نسخة أخرى من البوت تعمل بالفعل من نفس المجلد.');
            process.exit(1);
        }
        throw err;
    }
}

function releaseSingleInstanceLock() {
    if (lockHandle !== null) {
        fs.closeSync(lockHandle);
        lockHandle = null;
    }

    if (fs.existsSync(lockFile)) {
        try {
            fs.unlinkSync(lockFile);
        } catch {
            // ignore lock cleanup failures
        }
    }
}

function scheduleReconnect(delay = 5000) {
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startBot().catch(err => {
            console.error('Failed to restart bot:', err.message);
            process.exit(1);
        });
    }, delay);
}

async function startBot() {
    if (isStarting) {
        return activeSock;
    }

    isStarting = true;

    try {
        await initDB();

        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
        const { version } = await fetchLatestBaileysVersion();
        logBanner(version);

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            browser: ['ElAawady Bot', 'Chrome', '120.0.0'],
            generateHighQualityLinkPreview: true
        });

        activeSock = sock;
        store.bind(sock.ev);

        sock.ev.on('connection.update', async update => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('\n=== WhatsApp QR Code ===\n');
                qrcode.generate(qr, { small: true });
                console.log('امسح QR Code أعلاه بهاتفك من WhatsApp > Linked Devices');
            }

            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                const isCurrentSocket = activeSock === sock;

                console.log(`\nانقطع الاتصال - الكود: ${reason || 'Unknown'}`);

                if (!isCurrentSocket) {
                    return;
                }

                activeSock = null;

                if (reason === DisconnectReason.badSession || reason === DisconnectReason.loggedOut) {
                    clearReconnectTimer();
                    console.log('الجلسة غير صالحة. احذف مجلد auth_info ثم أعد ربط الحساب.');
                    process.exit(1);
                }

                if (reason === DisconnectReason.restartRequired) {
                    console.log('واتساب طلب إعادة تشغيل الجلسة بعد الربط. جاري إعادة التشغيل...');
                    scheduleReconnect(1000);
                    return;
                }

                if (reason === DisconnectReason.connectionReplaced) {
                    clearReconnectTimer();
                    console.log('تم استبدال الاتصال بجلسة أخرى. أوقفت إعادة الاتصال التلقائية لتجنب الحلقة.');
                    return;
                }

                console.log('جاري إعادة الاتصال تلقائياً...');
                scheduleReconnect(5000);
                return;
            }

            if (connection === 'open') {
                clearReconnectTimer();
                console.log('\nالبوت متصل بنجاح!');
                console.log(`رقم البوت: ${sock.user?.id?.split(':')[0] || 'Loading...'}`);
                console.log(`الأدمنية: ${config.OWNERS.join(', ')}`);
                console.log(`البادئة: ${config.PREFIX}`);
                console.log('\n--- جاهز للاستخدام! ---');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async ({ type, messages }) => {
            if (type !== 'notify') {
                return;
            }

            for (const msg of messages) {
                if (!msg.message || msg.key.fromMe) {
                    continue;
                }

                try {
                    await handleMessage(sock, msg, store);
                } catch (err) {
                    console.error('خطأ في معالجة الرسالة:', err.message);
                }
            }
        });

        sock.ev.on('group-participants.update', async update => {
            try {
                const { welcomeGoodbye } = require('./src/features/welcome');
                await welcomeGoodbye(sock, update);
            } catch {
                // ignore welcome errors
            }
        });

        return sock;
    } finally {
        isStarting = false;
    }
}

process.on('uncaughtException', err => {
    console.error('Fatal error:', err.message);
    releaseSingleInstanceLock();
    process.exit(1);
});

process.on('unhandledRejection', err => {
    console.error('Unhandled rejection:', err?.message || err);
});

process.on('SIGINT', () => {
    releaseSingleInstanceLock();
    process.exit(0);
});

process.on('SIGTERM', () => {
    releaseSingleInstanceLock();
    process.exit(0);
});

console.log('تشغيل البوت...');
acquireSingleInstanceLock();
startBot().catch(err => {
    console.error('فشل التشغيل:', err.message);
    releaseSingleInstanceLock();
    process.exit(1);
});
