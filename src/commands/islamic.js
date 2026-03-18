// src/commands/islamic.js — أوامر إسلامية مدعومة بـ APIs حقيقية (لا تكرار)
//
// APIs المستخدمة:
//   📖 القرآن     → api.alquran.cloud           (6236 آية + بحث كامل)
//   📿 الأذكار    → raw.githubusercontent.com    (حصن المسلم JSON كامل)
//   📚 الأحاديث   → cdn.jsdelivr.net fawazahmed0  (بخاري/مسلم/... كاملة)
//   🔍 بحث حديث  → dorar.net API
//   🕌 الصلاة     → api.aladhan.com/timingsByCity (مواقيت دقيقة بالمدينة)
//   📅 الهجري     → api.aladhan.com/gToH
//   🧭 القبلة     → api.aladhan.com/qibla

'use strict';
const axios = require('axios');
const { askGemini } = require('../features/gemini');

// ══════════════════════════════════════════════════════
//  طبقة API مركزية مع Fallback ذكي
// ══════════════════════════════════════════════════════

/** جلب آية بمرجع رقمي 1-6236 */
async function apiGetAyah(ref) {
    const r = await axios.get(`https://api.alquran.cloud/v1/ayah/${ref}/ar.alafasy`, { timeout: 12000 });
    return r.data.data; // { text, surah:{name,number}, numberInSurah, number }
}

/** جلب آية عشوائية حقيقية (مختلفة دائماً) */
async function apiRandomAyah() {
    const num = Math.floor(Math.random() * 6236) + 1;
    return apiGetAyah(num);
}

/** جلب سورة كاملة */
async function apiGetSurah(id) {
    const r = await axios.get(`https://api.alquran.cloud/v1/surah/${id}`, { timeout: 14000 });
    return r.data.data; // { name, numberOfAyahs, revelationType, ayahs:[...] }
}

/** بحث في القرآن */
async function apiSearchQuran(keyword) {
    const r = await axios.get(
        `https://api.alquran.cloud/v1/search/${encodeURIComponent(keyword)}/all/ar`,
        { timeout: 12000 }
    );
    return r.data.data; // { count, matches:[...] }
}

/**
 * جلب أذكار حصن المسلم من GitHub
 * category: 'الصباح' | 'المساء' | 'النوم' | 'الاستيقاظ'
 * يُعيد مصفوفة { zikr, repeat, reference } مختلفة في كل مرة (shuffle)
 */
const AZKAR_CACHE = {}; // cache لتفادي الطلبات المتكررة
async function apiGetAzkar(category) {
    const key = category;
    if (!AZKAR_CACHE[key]) {
        const r = await axios.get(
            'https://raw.githubusercontent.com/nawafalqari/azkar-api/56df51b5e748b73ee00f6e5bd87ed4c4b9bb7e02/azkar.json',
            { timeout: 14000 }
        );
        const all = r.data;
        const found = all.find(z => z.category && z.category.includes(category));
        AZKAR_CACHE[key] = found ? found.array : [];
    }
    // نُعيد نسخة مخلوطة لتفادي التكرار
    return [...AZKAR_CACHE[key]].sort(() => Math.random() - 0.5);
}

/**
 * جلب حديث عشوائي من fawazahmed0 CDN (مجاني 100%، بلا API key)
 * يختار كتاباً وحديثاً مختلفَين في كل مرة
 */
const HADITH_BOOKS = [
    { slug: 'ara-bukhari',  name: 'صحيح البخاري',  max: 7563 },
    { slug: 'ara-muslim',   name: 'صحيح مسلم',     max: 3033 },
    { slug: 'ara-abudawud', name: 'سنن أبي داود',  max: 5274 },
    { slug: 'ara-tirmidhi', name: 'سنن الترمذي',   max: 3956 },
    { slug: 'ara-nasai',    name: 'سنن النسائي',    max: 5761 },
    { slug: 'ara-ibnmajah', name: 'سنن ابن ماجه',  max: 4341 },
];

async function apiGetHadith(bookSlug = null, num = null) {
    const book = bookSlug
        ? HADITH_BOOKS.find(b => b.slug === bookSlug) || HADITH_BOOKS[0]
        : HADITH_BOOKS[Math.floor(Math.random() * HADITH_BOOKS.length)];
    const n = num || Math.floor(Math.random() * book.max) + 1;
    const r = await axios.get(
        `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${book.slug}/${n}.json`,
        { timeout: 14000 }
    );
    const h = r.data?.hadiths?.[0];
    if (!h) throw new Error('not_found');
    return { text: h.text, source: book.name, number: n };
}

/** مواقيت الصلاة الدقيقة — aladhan.com */
const CITY_MAP = {
    'القاهرة':       ['Cairo',       'Egypt',        5],
    'مصر':           ['Cairo',       'Egypt',        5],
    'الإسكندرية':    ['Alexandria',  'Egypt',        5],
    'الجيزة':        ['Giza',        'Egypt',        5],
    'الأسكندرية':    ['Alexandria',  'Egypt',        5],
    'الرياض':        ['Riyadh',      'Saudi Arabia', 4],
    'السعودية':      ['Riyadh',      'Saudi Arabia', 4],
    'مكة':           ['Mecca',       'Saudi Arabia', 4],
    'مكة_المكرمة':   ['Mecca',       'Saudi Arabia', 4],
    'المدينة':       ['Medina',      'Saudi Arabia', 4],
    'المدينة_المنورة':['Medina',     'Saudi Arabia', 4],
    'جدة':           ['Jeddah',      'Saudi Arabia', 4],
    'الدمام':        ['Dammam',      'Saudi Arabia', 4],
    'الكويت':        ['Kuwait City', 'Kuwait',       9],
    'دبي':           ['Dubai',       'UAE',          3],
    'الإمارات':      ['Abu Dhabi',   'UAE',          3],
    'أبوظبي':        ['Abu Dhabi',   'UAE',          3],
    'عمان':          ['Muscat',      'Oman',         3],
    'الدوحة':        ['Doha',        'Qatar',        3],
    'قطر':           ['Doha',        'Qatar',        3],
    'البحرين':       ['Manama',      'Bahrain',      3],
    'المنامة':       ['Manama',      'Bahrain',      3],
    'عمّان':         ['Amman',       'Jordan',       3],
    'الأردن':        ['Amman',       'Jordan',       3],
    'بيروت':         ['Beirut',      'Lebanon',      3],
    'لبنان':         ['Beirut',      'Lebanon',      3],
    'دمشق':          ['Damascus',    'Syria',        3],
    'سوريا':         ['Damascus',    'Syria',        3],
    'بغداد':         ['Baghdad',     'Iraq',         3],
    'العراق':        ['Baghdad',     'Iraq',         3],
    'تونس':          ['Tunis',       'Tunisia',      3],
    'الجزائر':       ['Algiers',     'Algeria',      3],
    'الرباط':        ['Rabat',       'Morocco',      3],
    'المغرب':        ['Rabat',       'Morocco',      3],
    'الدار_البيضاء': ['Casablanca',  'Morocco',      3],
    'الخرطوم':       ['Khartoum',    'Sudan',        3],
    'طرابلس':        ['Tripoli',     'Libya',        3],
    'صنعاء':         ['Sanaa',       'Yemen',        3],
};

async function apiGetPrayerTimes(cityAr) {
    const [city, country, method] = CITY_MAP[cityAr] || ['Cairo', 'Egypt', 5];
    const d   = new Date();
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const r = await axios.get(
        `https://api.aladhan.com/v1/timingsByCity/${dd}-${mm}-${yyyy}` +
        `?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`,
        { timeout: 12000 }
    );
    return { timings: r.data.data.timings, city, country };
}

/** التاريخ الهجري — aladhan.com */
async function apiGetHijriDate(date = null) {
    const d   = date || new Date();
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const r = await axios.get(`https://api.aladhan.com/v1/gToH/${dd}-${mm}-${yyyy}`, { timeout: 10000 });
    return r.data.data.hijri; // { day, month:{ar,en,number}, year, weekday:{ar,en} }
}

/** اتجاه القبلة — aladhan.com */
const COORD_MAP = {
    'القاهرة':   [30.06,  31.25], 'الإسكندرية': [31.20,  29.92],
    'الرياض':    [24.69,  46.72], 'مكة':         [21.39,  39.86],
    'المدينة':   [24.47,  39.61], 'جدة':          [21.49,  39.19],
    'دبي':       [25.20,  55.27], 'أبوظبي':       [24.47,  54.37],
    'الكويت':    [29.37,  47.98], 'الدوحة':       [25.29,  51.53],
    'عمان':      [23.61,  58.59], 'البحرين':      [26.22,  50.58],
    'عمّان':     [31.96,  35.95], 'بيروت':        [33.89,  35.50],
    'دمشق':      [33.51,  36.29], 'بغداد':        [33.34,  44.40],
    'تونس':      [36.82,  10.17], 'الجزائر':      [36.74,   3.06],
    'الرباط':    [34.02,  -6.84], 'الخرطوم':      [15.56,  32.54],
};

async function apiGetQibla(cityAr) {
    const coords = COORD_MAP[cityAr] || COORD_MAP['القاهرة'];
    const r = await axios.get(
        `https://api.aladhan.com/v1/qibla/${coords[0]}/${coords[1]}`,
        { timeout: 10000 }
    );
    return parseFloat(r.data.data.direction);
}

// ══════════════════════════════════════════════════════
//  أسماء الله الحسنى (99 اسم مع المعاني — محلية للسرعة)
// ══════════════════════════════════════════════════════
const ASMA_ALLAH = [
    { n: 'الله',       m: 'الاسم الجامع الأعظم، المعبود بحق الذي تعبده القلوب محبةً وخضوعاً وتعظيماً.' },
    { n: 'الرحمن',    m: 'ذو الرحمة الواسعة الشاملة لكل الخلق في الدنيا مؤمنهم وكافرهم.' },
    { n: 'الرحيم',    m: 'ذو الرحمة الخاصة بالمؤمنين في الآخرة، رحمة تنجيهم وترفعهم.' },
    { n: 'الملك',     m: 'مالك الملك كله، بيده مقاليد كل شيء، لا شريك له في سلطانه.' },
    { n: 'القدوس',    m: 'المُنزَّه المُطهَّر عن كل عيب ونقص في ذاته وصفاته وأفعاله.' },
    { n: 'السلام',    m: 'ذو السلامة من كل نقص وآفة، ومنه يُفاض السلام على عباده.' },
    { n: 'المؤمن',    m: 'الذي يمنح أولياءه الأمان ويصدِّق رسله بالآيات والدلائل.' },
    { n: 'المهيمن',   m: 'الرقيب الحافظ الشاهد على كل شيء، المسيطر على الأمور كلها.' },
    { n: 'العزيز',    m: 'الغالب الذي لا يُقهر، العزيز في ذاته وقدرته وانتقامه.' },
    { n: 'الجبار',    m: 'الذي يجبر كسر الضعفاء ويقهر الجبارين، القاهر فوق عباده.' },
    { n: 'المتكبر',   m: 'الذي له الكبرياء المطلق، المتعالي عن كل ما لا يليق بجلاله.' },
    { n: 'الخالق',    m: 'المُوجِد من العدم، الذي يخلق ما يشاء كيف يشاء بلا مثيل.' },
    { n: 'البارئ',    m: 'الذي يُبرئ الخلق ويُخرجهم متمايزين بغير نقص ولا خلل.' },
    { n: 'المصوِّر',  m: 'الذي يصوِّر الخلق على هيئات متعددة لكل صورتها وسمتها.' },
    { n: 'الغفار',    m: 'كثير المغفرة، يغفر الذنوب مراراً وتكراراً لمن يتوب ويرجع.' },
    { n: 'القهار',    m: 'الغالب الذي قهر كل شيء بقدرته، لا مفرَّ من حكمه.' },
    { n: 'الوهاب',    m: 'كثير الهبات، يعطي بلا عِوض ولا منٍّ، عطاؤه غير محدود.' },
    { n: 'الرزاق',    m: 'المتكفِّل بأرزاق الخلق كلهم، حيوانهم وإنسانهم ودوابهم.' },
    { n: 'الفتاح',    m: 'يفتح أبواب الخير والرزق والرحمة، ويفصل بين الحق والباطل.' },
    { n: 'العليم',    m: 'أحاط علمه بكل شيء سرَّاً وعلناً، ماضياً وحاضراً ومستقبلاً.' },
    { n: 'القابض',    m: 'الذي يقبض الأرواح والأرزاق بحكمته وعدله.' },
    { n: 'الباسط',    m: 'الذي يبسط الرزق والرحمة على من يشاء من عباده.' },
    { n: 'الخافض',    m: 'الذي يخفض الجبارين والطغاة وينزل كل شيء إلى مكانه.' },
    { n: 'الرافع',    m: 'الذي يرفع المؤمنين بالإيمان والعمل الصالح ويعلي منازلهم.' },
    { n: 'المُعِزّ',  m: 'الذي يُعِز من يشاء من عباده بالنصر والتمكين.' },
    { n: 'المُذِل',   m: 'الذي يُذِل من يشاء ممن استحق الذل بكفره وطغيانه.' },
    { n: 'السميع',    m: 'يسمع كل شيء ظاهراً وخافياً، لا يخفى عليه همس ولا سرار.' },
    { n: 'البصير',    m: 'يرى كل شيء دقيقه وجليله ظاهره وخافيه.' },
    { n: 'الحَكَم',   m: 'الحاكم العدل الذي يفصل بين الخلق بالحق ولا يظلم أحداً.' },
    { n: 'العدل',     m: 'يضع كل شيء في موضعه، لا يجور في حكمه أبداً.' },
    { n: 'اللطيف',    m: 'الرفيق بعباده، يوصل إليهم البرَّ بطرق خفية لا يحتسبونها.' },
    { n: 'الخبير',    m: 'المطَّلع على خفايا الأمور وبواطنها، لا تخفى عليه خافية.' },
    { n: 'الحليم',    m: 'يتأخر في عقوبة العاصين رحمةً وحلماً لعلهم يتوبون.' },
    { n: 'العظيم',    m: 'له العظمة المطلقة في ذاته وصفاته وأفعاله.' },
    { n: 'الغفور',    m: 'الستَّار على عباده، يمحو ذنوبهم ولا يفضحهم.' },
    { n: 'الشكور',    m: 'يشكر اليسير من العمل فيجازي عليه بالجزيل من الثواب.' },
    { n: 'العلي',     m: 'المتعالي بذاته وقدره وقهره فوق كل شيء.' },
    { n: 'الكبير',    m: 'له الكبرياء الحقيقي المطلق، أكبر من كل شيء.' },
    { n: 'الحفيظ',    m: 'يحفظ خلقه وأعمالهم وأرزاقهم، لا يضيع عنده شيء.' },
    { n: 'المُقيت',   m: 'يُقيت الخلق ويوصل إليهم أقواتهم وما يحتاجونه.' },
    { n: 'الحسيب',    m: 'الكافي لعباده والمحاسِب لهم على أعمالهم بالعدل.' },
    { n: 'الجليل',    m: 'ذو الجلال والعظمة والكبرياء، تُجلِّله الملائكة والأنبياء.' },
    { n: 'الكريم',    m: 'الواسع الكرم، يعطي بلا سبب ويعفو بلا ثمن.' },
    { n: 'الرقيب',    m: 'المطَّلع على الخلق في كل حال، الشاهد على أعمالهم.' },
    { n: 'المجيب',    m: 'يستجيب لدعاء عباده ويجيب المضطرين إذا دعوه.' },
    { n: 'الواسع',    m: 'وسعت رحمته كل شيء وعلمه كل شيء.' },
    { n: 'الحكيم',    m: 'يضع الأشياء في مواضعها اللائقة وفق حكمته البالغة.' },
    { n: 'الودود',    m: 'يحب أولياءه ويحبُّونه، محبة خالصة كاملة.' },
    { n: 'المجيد',    m: 'ذو المجد التام والشرف الرفيع والسعة في الكرم.' },
    { n: 'الباعث',    m: 'يبعث الخلق من قبورهم ليوم الحساب.' },
    { n: 'الشهيد',    m: 'لا يغيب عنه شيء، شاهد على كل ما في الكون.' },
    { n: 'الحق',      m: 'الثابت الوجود الذي لا يتغير، وكل ما سواه باطل.' },
    { n: 'الوكيل',    m: 'تفويض الأمور إليه والتوكل عليه عبادة وطمأنينة.' },
    { n: 'القوي',     m: 'الكامل القوة الذي لا يُغلَب ولا يُعجَز.' },
    { n: 'المتين',    m: 'الشديد القوة الثابت الذي لا يتزعزع ولا يُضعَف.' },
    { n: 'الوَلِيّ',  m: 'الناصر المحب لأوليائه، يتولَّاهم بعنايته ورعايته.' },
    { n: 'الحميد',    m: 'المحمود في ذاته وصفاته وأفعاله، المستحق للحمد المطلق.' },
    { n: 'المُحصي',   m: 'أحصى كل شيء وعلمه إحصاءً دقيقاً لا يخطئ.' },
    { n: 'المُبدئ',   m: 'بدأ الخلق من العدم ابتداءً لم يسبقه مثيل.' },
    { n: 'المُعيد',   m: 'يُعيد الخلق بعد فنائهم في يوم البعث.' },
    { n: 'المُحيي',   m: 'يُحيي الموتى وينبت الأرض بعد موتها.' },
    { n: 'المُميت',   m: 'يُميت الأحياء في الأجل المضروب، لا مفرَّ من حكمه.' },
    { n: 'الحيّ',     m: 'الدائم الحياة الكاملة التي لا تشبه حياة المخلوقين.' },
    { n: 'القيّوم',   m: 'القائم بنفسه المُقوِّم لغيره، به قيام كل شيء.' },
    { n: 'الواجد',    m: 'لا يفتقر ولا يعدم شيئاً، الغني بذاته عن كل شيء.' },
    { n: 'الماجد',    m: 'ذو المجد الكبير والشرف الباذخ والكرم السامي.' },
    { n: 'الواحد',    m: 'المتفرِّد في ذاته وصفاته وأفعاله، لا شريك له.' },
    { n: 'الأحد',     m: 'المتوحِّد الذي لا يقبل الشركة ولا الانقسام بأي وجه.' },
    { n: 'الصمد',     m: 'الذي يُقصَد في الحاجات والمهمات، الكامل المكتفي بذاته.' },
    { n: 'القادر',    m: 'يقدر على كل ما يريد بلا عجز ولا ضعف.' },
    { n: 'المقتدر',   m: 'البالغ الكمال في القدرة على كل شيء.' },
    { n: 'المقدِّم',  m: 'يُقدِّم ما شاء من خلقه بعلمه وحكمته.' },
    { n: 'المؤخِّر',  m: 'يُؤخِّر ما شاء في حكمته وتدبيره.' },
    { n: 'الأول',     m: 'لا ابتداء له، سابق لكل شيء بلا بداية.' },
    { n: 'الآخر',     m: 'لا نهاية له، الباقي بعد فناء كل شيء.' },
    { n: 'الظاهر',    m: 'ظهر بآياته وأدلته وقهر كل شيء بقدرته.' },
    { n: 'الباطن',    m: 'المحتجب عن إدراك الأبصار وعلم الخلق بكنه ذاته.' },
    { n: 'الوالي',    m: 'المالك للأشياء المتصرِّف فيها وفق إرادته وحكمته.' },
    { n: 'المتعالي',  m: 'المتنزِّه عن مماثلة خلقه، العالي علوَّاً مطلقاً.' },
    { n: 'البَرّ',    m: 'كثير البر والإحسان لعباده، الصادق في وعوده.' },
    { n: 'التواب',    m: 'يقبل توبة عباده مهما كثرت ذنوبهم.' },
    { n: 'المنتقم',   m: 'ينتقم من الظالمين ويردُّ الحق للمظلومين.' },
    { n: 'العفوّ',    m: 'كثير العفو، يمحو الذنوب ولا يؤاخذ بها.' },
    { n: 'الرؤوف',    m: 'الشديد الرحمة بعباده، أشد من رحمة الأم بولدها.' },
    { n: 'مالك الملك',    m: 'يملك الملك كله ويُعطيه لمن يشاء وينزعه ممن يشاء.' },
    { n: 'ذو الجلال والإكرام', m: 'الجامع للجلال بصفات العظمة، والإكرام بصفات الجمال والكرم.' },
    { n: 'المُقسط',   m: 'العادل في حكمه الذي لا يجور على أحد من خلقه.' },
    { n: 'الجامع',    m: 'يجمع الخلق يوم القيامة ويجمع بين المتفرِّقات بحكمته.' },
    { n: 'الغني',     m: 'المستغني عن كل ما سواه، لا يحتاج إلى أحد.' },
    { n: 'المُغني',   m: 'يُغني من يشاء من عباده ويكشف فقرهم.' },
    { n: 'المانع',    m: 'يمنع من يشاء بحكمته، حمايةً لا بخلاً.' },
    { n: 'الضار',     m: 'يُنزل الضرر بمن يستحقه وفق حكمته وعدله.' },
    { n: 'النافع',    m: 'يُنزل النفع على من يشاء فضلاً منه وكرماً.' },
    { n: 'النور',     m: 'نور السماوات والأرض، أنار القلوب بنور الإيمان والهداية.' },
    { n: 'الهادي',    m: 'يهدي من يشاء إلى الصراط المستقيم.' },
    { n: 'البديع',    m: 'أبدع الخلق على غير مثال سابق.' },
    { n: 'الباقي',    m: 'الدائم الذي لا يفنى ولا يزول، الباقي بعد فناء كل شيء.' },
    { n: 'الوارث',    m: 'يرث الأرض ومن عليها بعد فناء الخلق.' },
    { n: 'الرشيد',    m: 'بلغت حكمته الغاية القصوى في تصريف جميع الأمور.' },
    { n: 'الصبور',    m: 'لا يُعجِّل العقوبة، يُمهل ولا يُهمل.' },
];

// ══════════════════════════════════════════════════════
//  المعالج الرئيسي
// ══════════════════════════════════════════════════════
async function handle(ctx) {
    const { command, sock, jid, msg, reply, args, text, sender, senderId } = ctx;

    // ────────────── القرآن الكريم ──────────────

    // [1] آية عشوائية (6236 آية — لا تتكرر بالعشوائية الحقيقية)
    if (['آية', 'اية', 'quran', 'قرآن', 'آية_عشوائية'].includes(command)) {
        await sock.sendMessage(jid, { react: { text: '📖', key: msg.key } });
        try {
            const a = await apiRandomAyah();
            await reply(
                `📖 *آية من القرآن الكريم*\n\n` +
                `﴿ ${a.text} ﴾\n\n` +
                `📌 *${a.surah.name}* — الآية ${a.numberInSurah}\n` +
                `🔢 رقم الآية الكلي في المصحف: ${a.number}`
            );
        } catch { await reply('❌ تعذّر الاتصال بـ API القرآن، جرب مجدداً.'); }
        return true;
    }

    // [2] آية بمرجع سورة:آية  مثال: .آية_من 2:255
    if (['آية_من', 'ayah'].includes(command)) {
        if (!text) return reply('📌 مثال: .آية_من 2:255  أو  .آية_من 255') && true;
        const ref = text.trim().replace(/\s+/, ':');
        try {
            const a = await apiGetAyah(ref);
            await reply(`📖 ﴿ ${a.text} ﴾\n\n📌 *${a.surah.name}* — آية ${a.numberInSurah}`);
        } catch { await reply('❌ مرجع غير صحيح. مثال: .آية_من 2:255'); }
        return true;
    }

    // [3] سورة كاملة مع معلومات
    if (['سورة', 'surah'].includes(command)) {
        if (!text) return reply('📌 مثال: .سورة الفاتحة  أو  .سورة 1') && true;
        await sock.sendMessage(jid, { react: { text: '📖', key: msg.key } });
        try {
            let id = isNaN(text.trim()) ? null : parseInt(text.trim());
            if (!id) {
                const s = await axios.get(
                    `https://api.alquran.cloud/v1/search/${encodeURIComponent(text.trim())}/surah/ar`,
                    { timeout: 12000 }
                );
                id = s.data?.data?.matches?.[0]?.surah?.number;
            }
            if (!id) return reply('❌ لم أجد السورة، جرب الرقم: .سورة 1') && true;
            const su = await apiGetSurah(id);
            const preview = su.ayahs.slice(0, 5).map((a, i) => `${i + 1}. ${a.text}`).join('\n\n');
            await reply(
                `📖 *سورة ${su.name}*\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `📋 عدد الآيات: ${su.numberOfAyahs}\n` +
                `📍 نوعها: ${su.revelationType === 'Meccan' ? '🕋 مكية' : '🕌 مدنية'}\n` +
                `🔢 رقمها في المصحف: ${su.number}\n` +
                `━━━━━━━━━━━━━━━━━━━\n\n` +
                `*أول 5 آيات:*\n\n${preview}\n\n` +
                `_... تحتوي ${su.numberOfAyahs} آية كاملة_`
            );
        } catch { await reply('❌ تعذّر جلب السورة.'); }
        return true;
    }

    // [4] بحث في القرآن
    if (['بحث_قرآن', 'search_quran'].includes(command)) {
        if (!text) return reply('📌 مثال: .بحث_قرآن الصبر') && true;
        await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } });
        try {
            const data = await apiSearchQuran(text);
            const matches = data?.matches?.slice(0, 4) || [];
            if (!matches.length) return reply('❌ لا نتائج لهذه الكلمة.') && true;
            const out = matches.map(m =>
                `📌 *${m.surah.name}* (${m.surah.number}:${m.numberInSurah})\n﴿ ${m.text} ﴾`
            ).join('\n\n━━━━━━━━━━━━━━━\n\n');
            await reply(
                `🔍 *نتائج البحث عن "${text}":*\n\n${out}\n\n` +
                `📊 إجمالي النتائج في القرآن: ${data.count}`
            );
        } catch { await reply('❌ خطأ في البحث.'); }
        return true;
    }

    // [5] فضل سورة
    if (['فضل_سورة', 'fadl', 'فضل'].includes(command)) {
        if (!text) return reply('📌 مثال: .فضل_سورة الكهف') && true;
        const f = await askGemini(
            `ما فضل قراءة سورة "${text}" من القرآن الكريم؟ ` +
            `استشهد بالأحاديث الصحيحة فقط ولا تخترع أحاديث. أجب بإيجاز (4 أسطر).`
        );
        await reply(`✨ *فضل سورة ${text}:*\n\n${f}`);
        return true;
    }

    // [6] جزء قرآني
    if (['جزء', 'juz'].includes(command)) {
        const juzNum = parseInt(text) || Math.floor(Math.random() * 30) + 1;
        if (juzNum < 1 || juzNum > 30) return reply('📌 رقم الجزء بين 1 و 30') && true;
        try {
            const r = await axios.get(`https://api.alquran.cloud/v1/juz/${juzNum}/ar.alafasy`, { timeout: 14000 });
            const data = r.data.data;
            const firstAyah = data.ayahs[0];
            await reply(
                `📖 *الجزء ${juzNum}*\n\n` +
                `🔢 عدد آياته: ${data.ayahs.length}\n` +
                `📌 يبدأ بـ: *${firstAyah.surah.name}* — آية ${firstAyah.numberInSurah}\n\n` +
                `﴿ ${firstAyah.text} ﴾`
            );
        } catch { await reply('❌ تعذّر جلب الجزء.'); }
        return true;
    }

    // ────────────── الأذكار (حصن المسلم API) ──────────────

    // [7] ذكر الصباح — يدور على كل الأذكار دون تكرار
    if (['صباح', 'ذكر_صباح', 'اذكار_صباح'].includes(command)) {
        await sock.sendMessage(jid, { react: { text: '🌅', key: msg.key } });
        try {
            const list = await apiGetAzkar('الصباح');
            if (!list.length) throw new Error('empty');
            // استخدام الدقيقة الحالية للتدوير بدون تكرار
            const idx = Math.floor(Date.now() / 60000) % list.length;
            const z   = list[idx];
            await reply(
                `🌅 *ذكر الصباح — (${idx + 1}/${list.length})*\n\n` +
                `📿 ${z.zikr}\n\n` +
                `🔁 التكرار: ${z.repeat || '1 مرة'}\n` +
                `📖 ${z.reference || 'حصن المسلم'}\n\n` +
                `_اكتب .اذكار_صباح مرة ثانية لذكر مختلف_`
            );
        } catch { await reply('❌ تعذّر جلب الأذكار. جرب مجدداً.'); }
        return true;
    }

    // [8] ذكر المساء
    if (['مساء', 'ذكر_مساء', 'اذكار_مساء'].includes(command)) {
        await sock.sendMessage(jid, { react: { text: '🌆', key: msg.key } });
        try {
            const list = await apiGetAzkar('المساء');
            if (!list.length) throw new Error('empty');
            const idx = Math.floor(Date.now() / 60000) % list.length;
            const z   = list[idx];
            await reply(
                `🌆 *ذكر المساء — (${idx + 1}/${list.length})*\n\n` +
                `📿 ${z.zikr}\n\n` +
                `🔁 التكرار: ${z.repeat || '1 مرة'}\n` +
                `📖 ${z.reference || 'حصن المسلم'}`
            );
        } catch { await reply('❌ تعذّر جلب الأذكار.'); }
        return true;
    }

    // [9] أذكار النوم
    if (['نوم', 'ذكر_نوم', 'اذكار_نوم'].includes(command)) {
        try {
            const list = await apiGetAzkar('النوم');
            if (!list.length) throw new Error('empty');
            const z = list[0]; // مخلوطة مسبقاً
            await reply(`🌙 *ذكر النوم:*\n\n📿 ${z.zikr}\n\n🔁 ${z.repeat || '1 مرة'}\n📖 ${z.reference || 'حصن المسلم'}`);
        } catch {
            await reply('🌙 *ذكر النوم:*\n\n📿 بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا\n\n🔁 مرة واحدة');
        }
        return true;
    }

    // [10] أذكار الاستيقاظ
    if (['استيقاظ', 'ذكر_استيقاظ', 'صحيان'].includes(command)) {
        try {
            const list = await apiGetAzkar('الاستيقاظ');
            if (!list.length) throw new Error('empty');
            const z = list[0];
            await reply(`☀️ *ذكر الاستيقاظ:*\n\n📿 ${z.zikr}\n\n🔁 ${z.repeat || '1 مرة'}\n📖 ${z.reference || 'حصن المسلم'}`);
        } catch {
            await reply('☀️ *ذكر الاستيقاظ:*\n\n📿 الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ');
        }
        return true;
    }

    // [11] عرض أذكار بفئة ورقم محدد — أو عشوائي
    if (['اذكار', 'azkar', 'ذكر'].includes(command)) {
        const catMap = {
            'صباح': 'الصباح', 'مساء': 'المساء', 'نوم': 'النوم', 'استيقاظ': 'الاستيقاظ',
            'الصباح': 'الصباح', 'المساء': 'المساء', 'النوم': 'النوم', 'الاستيقاظ': 'الاستيقاظ',
        };
        const cat = catMap[args[0]] || 'الصباح';
        await sock.sendMessage(jid, { react: { text: '📿', key: msg.key } });
        try {
            const list = await apiGetAzkar(cat);
            if (!list.length) return reply('❌ فئات متاحة: صباح، مساء، نوم، استيقاظ') && true;
            const n = parseInt(args[1]);
            const z = (!isNaN(n) && n >= 1 && n <= list.length) ? list[n - 1] : list[0];
            const idx = list.indexOf(z) + 1;
            await reply(
                `📿 *أذكار ${cat} — (${idx}/${list.length})*\n\n` +
                `${z.zikr}\n\n` +
                `🔁 ${z.repeat || '1 مرة'}\n📖 ${z.reference || ''}\n\n` +
                `💡 _.اذكار ${args[0] || 'صباح'} [رقم]_ لذكر محدد`
            );
        } catch { await reply('❌ تعذّر جلب الأذكار.'); }
        return true;
    }

    // ────────────── الأحاديث النبوية ──────────────

    // [12] حديث عشوائي من كتاب عشوائي (لا يتكرر)
    if (['حديث', 'hadith'].includes(command)) {
        await sock.sendMessage(jid, { react: { text: '📚', key: msg.key } });
        try {
            const h = await apiGetHadith();
            await reply(
                `📚 *حديث نبوي شريف*\n` +
                `━━━━━━━━━━━━━━━━━━━\n\n` +
                `❝ ${h.text} ❞\n\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `📖 *${h.source}* — رقم ${h.number}`
            );
        } catch { await reply('❌ تعذّر جلب الحديث، جرب مجدداً.'); }
        return true;
    }

    // [13] حديث من كتاب محدد برقم اختياري
    if (['حديث_بخاري', 'حديث_مسلم', 'حديث_ترمذي', 'حديث_ابوداود', 'حديث_نسائي', 'حديث_ماجه'].includes(command)) {
        const slugMap = {
            'حديث_بخاري':  'ara-bukhari',
            'حديث_مسلم':   'ara-muslim',
            'حديث_ترمذي':  'ara-tirmidhi',
            'حديث_ابوداود':'ara-abudawud',
            'حديث_نسائي':  'ara-nasai',
            'حديث_ماجه':   'ara-ibnmajah',
        };
        const n = parseInt(args[0]) || null;
        try {
            const h = await apiGetHadith(slugMap[command], n);
            await reply(`📚 *${h.source} — رقم ${h.number}*\n\n❝ ${h.text} ❞`);
        } catch { await reply('❌ الحديث غير موجود بهذا الرقم.'); }
        return true;
    }

    // [14] بحث في الأحاديث (dorar.net)
    if (['بحث_حديث', 'search_hadith'].includes(command)) {
        if (!text) return reply('📌 مثال: .بحث_حديث الطهارة') && true;
        await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } });
        try {
            const r = await axios.get(
                `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(text)}`,
                { timeout: 15000 }
            );
            const results = r.data?.ahadith?.result;
            if (!results?.length) return reply('❌ لا نتائج لهذا البحث.') && true;
            const top = results.slice(0, 3).map((h, i) =>
                `${i + 1}. ❝${h.hadith.substring(0, 200)}...❞\n📖 ${h.rawi} | درجة: ${h.grade || '—'}`
            ).join('\n\n━━━━━━━━━\n\n');
            await reply(`🔍 *نتائج البحث عن "${text}":*\n\n${top}`);
        } catch { await reply('❌ تعذّر البحث في الأحاديث.'); }
        return true;
    }

    // ────────────── مواقيت الصلاة ──────────────

    // [15] مواقيت الصلاة الدقيقة من aladhan
    if (['صلاة', 'مواقيت', 'prayer', 'اوقات_صلاة'].includes(command)) {
        await sock.sendMessage(jid, { react: { text: '🕌', key: msg.key } });
        const cityArg = args[0] || 'القاهرة';
        try {
            const { timings } = await apiGetPrayerTimes(cityArg);
            const prayers = [
                { ar: 'الفجر',   en: 'Fajr',    em: '🌙' },
                { ar: 'الشروق',  en: 'Sunrise',  em: '🌅' },
                { ar: 'الظهر',   en: 'Dhuhr',   em: '☀️' },
                { ar: 'العصر',   en: 'Asr',     em: '🌤️' },
                { ar: 'المغرب',  en: 'Maghrib',  em: '🌇' },
                { ar: 'العشاء',  en: 'Isha',    em: '🌃' },
            ];
            const lines = prayers.map(p => `${p.em} *${p.ar}:* ${timings[p.en]}`).join('\n');
            let hijri = '';
            try {
                const h = await apiGetHijriDate();
                hijri = `📅 ${h.day} ${h.month.ar} ${h.year}هـ\n`;
            } catch {}
            await reply(
                `🕌 *مواقيت الصلاة — ${cityArg}*\n${hijri}` +
                `━━━━━━━━━━━━━━━━━━━\n\n${lines}\n\n` +
                `━━━━━━━━━━━━━━━━━━━\n📍 aladhan.com`
            );
        } catch {
            await reply(
                `❌ لم أجد مدينة "${cityArg}".\n` +
                `🏙️ المدن المتاحة:\nالقاهرة، الرياض، مكة، المدينة، جدة، دبي، الكويت،\n` +
                `الدوحة، عمان، البحرين، عمّان، بيروت، دمشق، بغداد،\n` +
                `تونس، الجزائر، الرباط، الخرطوم`
            );
        }
        return true;
    }

    // ────────────── التاريخ الهجري ──────────────

    // [16] التاريخ الهجري اليوم (دقيق من API)
    if (['تاريخ_هجري', 'hijri', 'هجري'].includes(command)) {
        try {
            const h = await apiGetHijriDate();
            await reply(
                `📅 *التاريخ الهجري اليوم*\n\n` +
                `🗓️ ${h.weekday?.ar || ''} ${h.day} ${h.month.ar} ${h.year} هـ\n` +
                `📖 الشهر: ${h.month.ar} (${h.month.number}/12)\n` +
                `📆 الميلادي: ${new Date().toLocaleDateString('ar-EG')}\n\n` +
                `📍 المصدر: aladhan.com`
            );
        } catch { await reply('❌ تعذّر جلب التاريخ الهجري.'); }
        return true;
    }

    // ────────────── القبلة ──────────────

    // [17] اتجاه القبلة بالدرجات (aladhan API)
    if (['قبلة', 'qibla'].includes(command)) {
        const city = text || 'القاهرة';
        try {
            const deg = await apiGetQibla(city);
            const dirs = ['شمال ↑', 'شمال شرق ↗', 'شرق ←', 'جنوب شرق ↘', 'جنوب ↓', 'جنوب غرب ↙', 'غرب →', 'شمال غرب ↖'];
            const compass = dirs[Math.round(deg / 45) % 8];
            await reply(
                `🕋 *اتجاه القبلة من ${city}*\n\n` +
                `🧭 الزاوية: *${deg.toFixed(1)}°*\n` +
                `📍 الاتجاه: *${compass}*\n\n` +
                `📍 المصدر: aladhan.com\n⚠️ استخدم بوصلة للتأكيد`
            );
        } catch { await reply(`❌ لم أجد إحداثيات "${city}". مثال: .قبلة القاهرة`); }
        return true;
    }

    // ────────────── أسماء الله الحسنى ──────────────

    // [18] اسم عشوائي أو محدد بالرقم
    if (['اسم_الله', 'asma', 'اسماء_الله'].includes(command)) {
        const idx = parseInt(args[0]);
        const entry = (!isNaN(idx) && idx >= 1 && idx <= 99)
            ? ASMA_ALLAH[idx - 1]
            : ASMA_ALLAH[Math.floor(Math.random() * ASMA_ALLAH.length)];
        const num = ASMA_ALLAH.indexOf(entry) + 1;
        await reply(
            `✨ *من أسماء الله الحسنى*\n\n` +
            `👑 *${entry.n}* — (${num}/99)\n\n` +
            `📖 ${entry.m}\n\n` +
            `_💡 .اسم_الله [1-99] لاسم محدد_`
        );
        return true;
    }

    // [19] كل الأسماء مع أرقامها
    if (['الاسماء_الحسنى', 'all_asma'].includes(command)) {
        const lines = ASMA_ALLAH.map((a, i) => `${i + 1}. *${a.n}*`).join('  •  ');
        await reply(`✨ *أسماء الله الحسنى (99 اسم):*\n\n${lines}`);
        return true;
    }

    // ────────────── أدعية وتسبيح ──────────────

    // [20] دعاء مأثور
    if (['دعاء', 'dua'].includes(command)) {
        const occ = text || 'عام';
        const dua = await askGemini(
            `أعطني دعاءً مأثوراً من القرآن الكريم أو من السنة النبوية الصحيحة لـ "${occ}". ` +
            `اكتب الدعاء بالعربية الفصيحة مع ذكر مصدره الصحيح فقط. لا تخترع أدعية.`
        );
        await reply(`🤲 *دعاء ${occ}:*\n\n${dua}`);
        return true;
    }

    // [21] تسبيح
    if (['تسبيح', 'tasbih'].includes(command)) {
        const count = parseInt(args[0]) || 33;
        await reply(
            `📿 *التسبيح × ${count}:*\n\n` +
            `سُبْحَانَ اللهِ  × ${count}\n` +
            `الْحَمْدُ لِلَّهِ  × ${count}\n` +
            `اللهُ أَكْبَرُ  × ${count}\n\n` +
            `لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ ×1\n\n` +
            `📖 _(صحيح مسلم 597)_`
        );
        return true;
    }

    // [22] استغفار
    if (['استغفار', 'astaghfar'].includes(command)) {
        const c = parseInt(args[0]) || 100;
        await reply(
            `🌿 *الاستغفار × ${c}*\n\n` +
            `أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ\n\n` +
            `أَسْتَغْفِرُ اللهَ الْعَظِيمَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ وَأَتُوبُ إِلَيْهِ\n\n` +
            `📖 _"من أكثر الاستغفار جعل الله له من كل ضيق مخرجاً"_ _(رواه أحمد)_`
        );
        return true;
    }

    // [23] الصلاة على النبي
    if (['صلاة_نبي', 'salawat', 'صلي_نبي'].includes(command)) {
        const c = parseInt(args[0]) || 10;
        await reply(
            `💚 *الصلاة على النبي ﷺ × ${c}*\n\n` +
            `اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ\n` +
            `كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ\n` +
            `إِنَّكَ حَمِيدٌ مَجِيدٌ\n\n` +
            `📖 _"من صلى عليَّ واحدة صلى الله عليه عشراً"_ ﷺ`
        );
        return true;
    }

    // ────────────── المعرفة الإسلامية ──────────────

    // [24] آية الكرسي
    if (['آية_الكرسي', 'ayat_kursi', 'الكرسي'].includes(command)) {
        await reply(
            `📖 *آية الكرسي*\n\n` +
            `﴿ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ ` +
            `لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ ` +
            `يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ ` +
            `وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ ﴾\n\n` +
            `📌 *البقرة: 255*\n\n` +
            `💡 _"من قرأها حين يُصبح أُجير من الجن حتى يُمسي، ومن قرأها حين يُمسي أُجير من الجن حتى يُصبح"_\n_(صحيح البخاري)_`
        );
        return true;
    }

    // [25] المعوذتان
    if (['معوذتان', 'muwwidhatain'].includes(command)) {
        await reply(
            `📖 *المعوذتان*\n\n` +
            `*🔹 سورة الفلق:*\n` +
            `﴿ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ • مِن شَرِّ مَا خَلَقَ • وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ • ` +
            `وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ • وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ ﴾\n\n` +
            `*🔹 سورة الناس:*\n` +
            `﴿ قُلْ أَعُوذُ بِرَبِّ النَّاسِ • مَلِكِ النَّاسِ • إِلَٰهِ النَّاسِ • مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ • ` +
            `الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ • مِنَ الْجِنَّةِ وَالنَّاسِ ﴾\n\n` +
            `💡 _يُقرآن ثلاثاً صباحاً ومساءً للحماية_`
        );
        return true;
    }

    // [26] الرقية الشرعية
    if (['رقية', 'ruqyah'].includes(command)) {
        await reply(
            `🛡️ *الرقية الشرعية*\n\n` +
            `اقرأ بنية الرقية:\n\n` +
            `1️⃣ الفاتحة × 7 (مع النفث)\n` +
            `2️⃣ آية الكرسي × 3\n` +
            `3️⃣ الإخلاص × 3\n` +
            `4️⃣ الفلق × 3\n` +
            `5️⃣ الناس × 3\n\n` +
            `🤲 ثم النفث على المريض أو في الماء\n\n` +
            `📖 _"وننزِّل من القرآن ما هو شفاء ورحمة للمؤمنين"_ (الإسراء: 82)`
        );
        return true;
    }

    // [27] قصة نبي
    if (['قصة_نبي', 'prophet', 'نبي'].includes(command)) {
        const p = text || 'موسى';
        const story = await askGemini(
            `اذكر قصة إيمانية مؤثرة ومختصرة من حياة النبي ${p} عليه السلام، ` +
            `مع الاستشهاد بآية قرآنية أو حديث صحيح. (150 كلمة فقط)`
        );
        await reply(`📖 *قصة النبي ${p} عليه السلام:*\n\n${story}`);
        return true;
    }

    // [28] مسألة فقهية
    if (['فقه', 'حكم', 'masala'].includes(command)) {
        if (!text) return reply('📌 مثال: .فقه حكم الصيام في السفر') && true;
        const ruling = await askGemini(
            `ما الحكم الشرعي في: "${text}"؟ ` +
            `أجب علمياً مختصراً مع ذكر الدليل من القرآن أو السنة الصحيحة. (100 كلمة فقط)`
        );
        await reply(
            `⚖️ *مسألة فقهية*\n\n❓ ${text}\n\n` +
            `📋 *الجواب:*\n${ruling}\n\n` +
            `⚠️ _للفتوى الرسمية الملزمة راجع عالم دين متخصص_`
        );
        return true;
    }

    // [29] أركان الإسلام والإيمان
    if (['اركان', 'pillars'].includes(command)) {
        await reply(
            `🕌 *أركان الإسلام الخمسة:*\n\n` +
            `1️⃣ شهادة أن لا إله إلا الله وأن محمداً رسول الله\n` +
            `2️⃣ إقامة الصلاة\n` +
            `3️⃣ إيتاء الزكاة\n` +
            `4️⃣ صوم رمضان\n` +
            `5️⃣ حج البيت لمن استطاع إليه سبيلا\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n\n` +
            `💎 *أركان الإيمان الستة:*\n\n` +
            `1️⃣ الإيمان بالله\n2️⃣ وملائكته\n3️⃣ وكتبه\n` +
            `4️⃣ ورسله\n5️⃣ واليوم الآخر\n6️⃣ والقدر خيره وشره`
        );
        return true;
    }

    // [30] الأشهر الهجرية
    if (['شهر_هجري', 'islamic_month'].includes(command)) {
        const months = [
            '1. المحرّم 🌟 — شهر الله المحرم، يُستحب صيام عاشوراء',
            '2. صفر',
            '3. ربيع الأول 💚 — شهر مولد النبي ﷺ',
            '4. ربيع الثاني',
            '5. جمادى الأولى',
            '6. جمادى الثانية',
            '7. رجب 🌙 — من الأشهر الحرم الأربعة',
            '8. شعبان 🌸 — تُرفع فيه الأعمال إلى الله',
            '9. رمضان 🌙⭐ — أشرف الشهور، فُرض فيه الصيام',
            '10. شوال 🎉 — عيد الفطر وست شوال',
            '11. ذو القعدة 🕋 — من الأشهر الحرم',
            '12. ذو الحجة 🕋⭐ — عشره أفضل أيام الدنيا، فيه الحج',
        ];
        await reply(`🗓️ *الأشهر الهجرية الاثنا عشر:*\n\n${months.join('\n')}`);
        return true;
    }

    return false;
}

module.exports = { handle };
