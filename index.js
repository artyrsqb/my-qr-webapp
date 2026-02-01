const { Telegraf } = require('telegraf');
const QRCode = require('qrcode');

// ВСТАВЬТЕ СЮДА ВАШ ТОКЕН
const bot = new Telegraf('8272074806:AAGqf9PtNkmlyI_Y7RpHV5NFPsq4YUzz5pI');

// Функция создания картинки QR-кода
async function createQR(text, color) {
    try {
        return await QRCode.toBuffer(text, {
            scale: 10,
            margin: 1,
            color: {
                dark: color,
                light: '#FFFFFF'
            }
        });
    } catch (err) {
        console.error('Ошибка генерации картинки:', err);
        return null;
    }
}

// Обработчик сообщений
bot.on('message', async (ctx) => {
    let dataFromWeb = null;

    // Вариант 1: Данные пришли с сайта (WebApp)
    if (ctx.message.web_app_data) {
        try {
            dataFromWeb = JSON.parse(ctx.message.web_app_data.data);
            console.log("Данные с сайта:", dataFromWeb);
        } catch (e) {
            console.error("Ошибка чтения JSON:", e);
        }
    } 
    // Вариант 2: Обычное текстовое сообщение
    else if (ctx.message.text && !ctx.message.text.startsWith('/')) {
        dataFromWeb = { text: ctx.message.text, color: '#000000' };
    }

    if (!dataFromWeb || !dataFromWeb.text) return;

    // Показываем статус "отправка фото..."
    await ctx.replyWithChatAction('upload_photo');

    const buffer = await createQR(dataFromWeb.text, dataFromWeb.color);

    if (buffer) {
        await ctx.replyWithPhoto({ source: buffer }, {
            caption: `✅ Готово!`
        });
    } else {
        await ctx.reply('❌ Ошибка генерации.');
    }
});

// Запуск
bot.launch().then(() => console.log('Бот успешно запущен!'));

// Остановка при закрытии окна
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));