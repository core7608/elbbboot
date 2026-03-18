// src/database.js - إدارة البيانات المحلية (JSON بسيط)

const fs = require('fs');
const path = require('path');

const DB_PATH = './data/db.json';

let db = {
    users: {},        // بيانات المستخدمين (نقاط، ليفل، إلخ)
    groups: {},       // إعدادات المجموعات
    games: {},        // حالة الألعاب الجارية
    warnings: {},     // التحذيرات
    antilinkGroups: [], // مجموعات الحماية من اللينكات
};

// تهيئة قاعدة البيانات
async function initDB() {
    if (fs.existsSync(DB_PATH)) {
        try {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            db = { ...db, ...JSON.parse(raw) };
            console.log('📂 تم تحميل قاعدة البيانات بنجاح');
        } catch (e) {
            console.log('⚠️ خطأ في تحميل DB، سيتم إنشاء قاعدة جديدة');
        }
    } else {
        saveDB();
        console.log('📂 تم إنشاء قاعدة بيانات جديدة');
    }
}

// حفظ البيانات
function saveDB() {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ─── إدارة المستخدمين (نظام الليفل) ───
function getUser(jid) {
    const id = jid.split('@')[0];
    if (!db.users[id]) {
        db.users[id] = { xp: 0, level: 1, points: 0, messages: 0, name: '' };
    }
    return db.users[id];
}

function addXP(jid, amount = 5) {
    const user = getUser(jid);
    user.xp += amount;
    user.messages += 1;
    
    // حساب الليفل
    const nextLevel = user.level * 100;
    if (user.xp >= nextLevel) {
        user.level += 1;
        user.xp = 0;
        saveDB();
        return { levelUp: true, newLevel: user.level };
    }
    saveDB();
    return { levelUp: false };
}

function getLeaderboard(groupId, limit = 10) {
    const entries = Object.entries(db.users)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (b.level * 1000 + b.xp) - (a.level * 1000 + a.xp))
        .slice(0, limit);
    return entries;
}

// ─── إدارة المجموعات ───
function getGroup(groupId) {
    if (!db.groups[groupId]) {
        db.groups[groupId] = {
            welcome: true,
            goodbye: true,
            antilink: false,
            badwords: false,
            antispam: false,
            muted: false,
            language: 'ar',
            welcomeMsg: '',
            goodbyeMsg: '',
        };
    }
    return db.groups[groupId];
}

function setGroupSetting(groupId, key, value) {
    const group = getGroup(groupId);
    group[key] = value;
    saveDB();
}

// ─── إدارة الألعاب ───
function getGame(groupId) {
    return db.games[groupId] || null;
}

function setGame(groupId, gameData) {
    db.games[groupId] = gameData;
    saveDB();
}

function deleteGame(groupId) {
    delete db.games[groupId];
    saveDB();
}

// ─── إدارة التحذيرات ───
function getWarnings(groupId, userId) {
    const key = `${groupId}_${userId}`;
    return db.warnings[key] || 0;
}

function addWarning(groupId, userId) {
    const key = `${groupId}_${userId}`;
    db.warnings[key] = (db.warnings[key] || 0) + 1;
    saveDB();
    return db.warnings[key];
}

function clearWarnings(groupId, userId) {
    const key = `${groupId}_${userId}`;
    db.warnings[key] = 0;
    saveDB();
}

module.exports = {
    initDB, saveDB, getUser, addXP, getLeaderboard,
    getGroup, setGroupSetting,
    getGame, setGame, deleteGame,
    getWarnings, addWarning, clearWarnings,
    db
};
