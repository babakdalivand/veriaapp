const { Sequelize } = require('sequelize');
const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS } = require('../config');

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false,
});

const SEED_QUOTES = [
  { text: 'خدا اختراع انسان است برای توجیه ترس و جهل خود.', author: 'صادق هدایت', category: 'ایرانی' },
  { text: 'تا وقتی که خرافات حکم‌فرماست، آزادی وجود ندارد.', author: 'احمد کسروی', category: 'ایرانی' },
  { text: 'شک، آغاز تفکر است و تفکر، آغاز آزادی.', author: 'میرزا فتحعلی آخوندزاده', category: 'ایرانی' },
  { text: 'پیشرفت واقعی زمانی آغاز می‌شود که انسان به جای دعا، عمل کند.', author: 'میرزا فتحعلی آخوندزاده', category: 'ایرانی' },
  { text: 'انسان باید خود خالق معنای زندگی‌اش باشد.', author: 'صادق هدایت', category: 'ایرانی' },
  { text: 'عقل آزاد، بالاترین نعمتی است که انسان می‌تواند داشته باشد.', author: 'احمد کسروی', category: 'ایرانی' },
  { text: 'خدا مُرده است. ما او را کشتیم — من و تو.', author: 'فریدریش نیچه', category: 'جهانی' },
  { text: 'آنچه ایمان می‌نامیم، باور کردن چیزی است که هیچ دلیلی برایش نداری.', author: 'ولتر', category: 'جهانی' },
  { text: 'در تاریخ، مذهب هرگز نیروی اخلاقی نبوده است.', author: 'برتراند راسل', category: 'جهانی' },
  { text: 'ایمان، رها کردن عقل در برابر اقتدار است.', author: 'سام هریس', category: 'جهانی' },
  { text: 'دین همه چیز را توضیح می‌دهد و در واقع هیچ چیز را توضیح نمی‌دهد.', author: 'ریچارد داوکینز', category: 'جهانی' },
  { text: 'خرد، تنها راهنمای انسان آزاد است.', author: 'اسپینوزا', category: 'جهانی' },
  { text: 'ترس از مرگ اولین مذهب را ساخت.', author: 'لوکرتیوس', category: 'جهانی' },
  { text: 'هرجا علم وارد شد، دین عقب نشست.', author: 'ویکتور هوگو', category: 'جهانی' },
  { text: 'دین وعده پاداش پس از مرگ است برای پذیرش ستم در طول زندگی.', author: 'کارل مارکس', category: 'جهانی' },
  { text: 'عقل ابزار یافتن حقیقت است، نه ایمان.', author: 'توماس پین', category: 'جهانی' },
  { text: 'وقتی انسان فضا را کاوش کرد، هیچ خدایی آنجا نیافت.', author: 'یوری گاگارین', category: 'جهانی' },
  { text: 'من نمی‌توانم باور کنم که خدایی مهربان موجوداتی آفریده که رنج می‌برند.', author: 'چارلز داروین', category: 'جهانی' },
];

async function connectDB() {
  try {
    await sequelize.authenticate();
    // Import models to register them before sync
    const Quote = require('./models/Quote');
    require('./models/BotCommand');
    await sequelize.sync();
    // Add new columns that may not exist yet (safe, idempotent)
    await sequelize.query(`ALTER TABLE Users ADD COLUMN IF NOT EXISTS premiumExpiry DATETIME NULL`).catch(() => {});
    await sequelize.query(`ALTER TABLE Users ADD COLUMN IF NOT EXISTS referredBy VARCHAR(255) NULL`).catch(() => {});
    await sequelize.query(`ALTER TABLE Users MODIFY COLUMN role ENUM('user','vip','premium','admin','owner') NOT NULL DEFAULT 'user'`).catch(() => {});
    // Seed quotes table if empty
    const count = await Quote.count().catch(() => -1);
    if (count === 0) {
      await Quote.bulkCreate(SEED_QUOTES).catch(e => console.error('Quote seed error:', e.message));
      console.log(`Seeded ${SEED_QUOTES.length} quotes`);
    }
    console.log('MySQL connected');
  } catch (err) {
    console.error('MySQL connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
