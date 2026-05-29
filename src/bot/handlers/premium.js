const { Markup } = require('telegraf');
const User = require('../../database/models/User');

const PREMIUM_STARS = 100; // Price in Telegram Stars

async function premiumMenuHandler(ctx) {
  const userId = ctx.from.id;
  const user = await User.findOne({ where: { telegramId: userId } });
  const isPremium = user?.role === 'premium' || user?.role === 'admin' || user?.role === 'owner';

  if (isPremium) {
    const expiry = user.premiumExpiry
      ? new Date(user.premiumExpiry).toLocaleDateString('fa-IR')
      : 'نامحدود';
    return ctx.reply(
      `⭐ *اشتراک پریمیوم*\n\n✅ شما اشتراک فعال دارید!\n\n📅 انقضا: ${expiry}\n\n_امکانات: دانلود نامحدود، دسترسی به AI، و بیشتر..._`,
      { parse_mode: 'Markdown' }
    );
  }

  await ctx.reply(
    `⭐ *اشتراک پریمیوم Veriaapp*\n\n` +
    `با خرید اشتراک به این امکانات دسترسی داری:\n\n` +
    `• 🤖 چت نامحدود با هوش مصنوعی\n` +
    `• 📺 دانلود نامحدود یوتیوب\n` +
    `• 📰 اخبار اختصاصی\n` +
    `• ⚡ اولویت پاسخ‌دهی\n\n` +
    `💰 قیمت: *${PREMIUM_STARS} Telegram Stars* (یک ماه)\n\n` +
    `روی دکمه زیر بزن تا خرید کنی:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`⭐ خرید ${PREMIUM_STARS} Stars`, 'premium:buy')]
      ])
    }
  );
}

async function premiumBuyCallback(ctx) {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;

  try {
    await ctx.replyWithInvoice({
      title: 'اشتراک پریمیوم Veriaapp',
      description: 'یک ماه دسترسی کامل به تمام امکانات پریمیوم',
      payload: `premium_${userId}_${Date.now()}`,
      currency: 'XTR', // Telegram Stars
      prices: [{ label: 'اشتراک یک ماهه', amount: PREMIUM_STARS }],
    });
  } catch (e) {
    await ctx.reply(`❌ خطا در ایجاد فاکتور: ${e.message.slice(0, 100)}`);
  }
}

async function preCheckoutHandler(ctx) {
  await ctx.answerPreCheckoutQuery(true);
}

async function successfulPaymentHandler(ctx) {
  const userId = ctx.from.id;
  const payload = ctx.message.successful_payment.invoice_payload;

  if (!payload.startsWith('premium_')) return;

  // Activate premium for 30 days
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);

  await User.update(
    { role: 'premium', premiumExpiry: expiry },
    { where: { telegramId: userId } }
  );

  await ctx.reply(
    `🎉 *پرداخت موفق!*\n\n✅ اشتراک پریمیوم شما فعال شد.\n\n📅 تاریخ انقضا: ${expiry.toLocaleDateString('fa-IR')}\n\nممنون از اعتمادت! 🙏`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = { premiumMenuHandler, premiumBuyCallback, preCheckoutHandler, successfulPaymentHandler };
