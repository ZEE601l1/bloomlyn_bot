import config from '../../config.js';

export default function registerStart(bot) {
  bot.onText(/\/start/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const welcomeMessage = `Heyy🌸\n\nWelcome to Bloomlyn, your destination for feminine elegance.\nTap below to explore our collections`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌸 Browse Collections", callback_data: "browse" }],
            [{ text: "My Orders", callback_data: "my_orders" }],
            [{ text: "Contact Support", callback_data: "support" }]
          ]
        },
      };

      await bot.sendMessage(chatId, welcomeMessage, opts);
    } catch (error) {
      console.error('❌ Error in /start handler:', error.message);
    }
  });

  bot.on('message', async (msg) => {
    try {
      if (msg.text === '📞 Support' || msg.text === 'Support') {
        await bot.sendMessage(msg.chat.id, `Contact us at @chat_bloomlyn for any inquiries or support.`);
      }
    } catch (error) {
      console.error('❌ Error in support handler:', error.message);
    }
  });

  bot.on('callback_query', async (query) => {
    if (query.data === 'support') {
      await bot.answerCallbackQuery(query.id);
      const message = `Contact us at @chat_bloomlyn for any inquiries or support.`;
      await bot.editMessageText(message, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Back", callback_data: "start" }]]
        }
      });
    }
    if (query.data === 'start') {
        await bot.answerCallbackQuery(query.id);
        const welcomeMessage = `Heyy🌸\n\nWelcome to Bloomlyn, your destination for feminine elegance.\nTap below to explore our collections`;
        const opts = {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🌸 Browse Collections", callback_data: "browse" }],
                [{ text: "My Orders", callback_data: "my_orders" }],
                [{ text: "Contact Support", callback_data: "support" }]
              ]
            },
          };
        await bot.editMessageText(welcomeMessage, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            ...opts
        });
    }
  });
}
