// ================================================
// IA EXPRESSO — Servidor Principal
// ================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { processMessage } = require('./aiEngine');
const { getProducts, getSettings, createOrder, updateCustomer } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// ================================================
// WhatsApp Client
// ================================================
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'ia-expresso' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
});

client.on('qr', (qr) => {
  console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:')
  qrcode.generate(qr, { small: false })
});

client.on('ready', () => {
  console.log('\n✅ WhatsApp conectado! Bot ativo.');
});

client.on('disconnected', (reason) => {
  console.log('❌ WhatsApp desconectado:', reason);
  client.initialize();
});

// Armazenar histórico e carrinho em memória (produção: use Redis)
const sessions = {};

client.on('message', async (msg) => {
  // Filtros de segurança
  if (msg.fromMe) return;
  if (msg.isGroupMsg) return;
  if (msg.timestamp < Date.now() / 1000 - 300) return; // >5 min

  const phone = msg.from.replace('@c.us', '');
  console.log(`[MSG] ${phone}: ${msg.body}`);

  // Inicializar sessão do cliente
  if (!sessions[phone]) sessions[phone] = { history: [], cart: [] };
  const session = sessions[phone];

  try {
    const products = await getProducts();
    const settings = await getSettings();

    const result = await processMessage({
      message: msg.body,
      history: session.history,
      cart: session.cart,
      products,
      settings,
      phone,
    });

    // Atualizar sessão
    session.history.push({ role: 'user', content: msg.body });
    session.history.push({ role: 'assistant', content: result.responseText });
    session.cart = result.cart;

    // Manter histórico de no máximo 20 mensagens
    if (session.history.length > 20) session.history = session.history.slice(-20);

    // Se pedido confirmado, criar pedido
    if (result.orderReady && session.cart.length > 0) {
      await createOrder({
        phone,
        cart: session.cart,
        channel: 'whatsapp',
      });
      session.cart = [];
      console.log(`[PEDIDO] Pedido criado para ${phone}`);
    }

    await msg.reply(result.responseText);
    console.log(`[OK] Respondido: ${phone}`);

  } catch (err) {
    console.error(`[ERRO] ${phone}:`, err.message);
    await msg.reply('Desculpe, tive um problema. Tente novamente em instantes! 🙏');
  }
});

// ================================================
// API REST — para testes externos ou webhooks
// ================================================
app.post('/api/message', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone e message são obrigatórios' });

  if (!sessions[phone]) sessions[phone] = { history: [], cart: [] };
  const session = sessions[phone];

  const products = await getProducts();
  const settings = await getSettings();

  const result = await processMessage({ message, history: session.history, cart: session.cart, products, settings, phone });

  session.history.push({ role: 'user', content: message });
  session.history.push({ role: 'assistant', content: result.responseText });
  session.cart = result.cart;

  res.json({
    response_text: result.responseText,
    intent: result.intent,
    cart: result.cart,
    order_ready: result.orderReady,
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', whatsapp: client.info?.pushname || 'conectando...' }));

// ================================================
// Inicializar
// ================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
client.initialize();
