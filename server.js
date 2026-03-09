// ================================================
// IA EXPRESSO — Servidor Principal
// ================================================
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')

const { processMessage } = require('./aiEngine')
const { getProducts, getSettings, createOrder, updateCustomer } = require('./database')

const app = express()
app.use(cors())
app.use(express.json())

// ================================================
// WhatsApp Client
// ================================================
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "ia-expresso"
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
})

// ================================================
// QR Code
// ================================================
client.on('qr', (qr) => {
  console.log('\n📱 Escaneie o QR Code abaixo com seu WhatsApp\n')

  qrcode.generate(qr, {
    small: true
  })

  console.log('\n⚠️  O QR expira em 30 segundos\n')
})

// ================================================
// WhatsApp Conectado
// ================================================
client.on('ready', () => {
  console.log('\n✅ WhatsApp conectado!')
  console.log(`👤 Conta: ${client.info.pushname}`)
  console.log('🤖 IA Expresso ativa\n')
})

// ================================================
// Reconexão automática
// ================================================
client.on('disconnected', (reason) => {
  console.log('❌ WhatsApp desconectado:', reason)
  console.log('🔄 Tentando reconectar...\n')

  client.initialize()
})

// ================================================
// Sessões em memória
// ================================================
const sessions = {}

// ================================================
// Receber mensagens
// ================================================
client.on('message', async (msg) => {

  if (msg.fromMe) return
  if (msg.isGroupMsg) return

  const phone = msg.from.replace('@c.us', '')

  console.log(`📩 ${phone}: ${msg.body}`)

  if (!sessions[phone]) {
    sessions[phone] = {
      history: [],
      cart: []
    }
  }

  const session = sessions[phone]

  try {

    const products = await getProducts()
    const settings = await getSettings()

    const result = await processMessage({
      message: msg.body,
      history: session.history,
      cart: session.cart,
      products,
      settings,
      phone
    })

    session.history.push({
      role: "user",
      content: msg.body
    })

    session.history.push({
      role: "assistant",
      content: result.responseText
    })

    session.cart = result.cart

    if (session.history.length > 20) {
      session.history = session.history.slice(-20)
    }

    if (result.orderReady && session.cart.length > 0) {

      await createOrder({
        phone,
        cart: session.cart,
        channel: "whatsapp"
      })

      console.log(`🛒 Pedido criado para ${phone}`)

      session.cart = []
    }

    await msg.reply(result.responseText)

    console.log(`✅ Respondido: ${phone}`)

  } catch (err) {

    console.error(`❌ ERRO ${phone}:`, err)

    await msg.reply(
      "Desculpe, tive um problema técnico. Tente novamente em instantes 🙏"
    )
  }
})

// ================================================
// API REST
// ================================================
app.post('/api/message', async (req, res) => {

  const { phone, message } = req.body

  if (!phone || !message) {
    return res.status(400).json({
      error: "phone e message são obrigatórios"
    })
  }

  if (!sessions[phone]) {
    sessions[phone] = { history: [], cart: [] }
  }

  const session = sessions[phone]

  const products = await getProducts()
  const settings = await getSettings()

  const result = await processMessage({
    message,
    history: session.history,
    cart: session.cart,
    products,
    settings,
    phone
  })

  session.history.push({ role: "user", content: message })
  session.history.push({ role: "assistant", content: result.responseText })
  session.cart = result.cart

  res.json({
    response_text: result.responseText,
    intent: result.intent,
    cart: result.cart,
    order_ready: result.orderReady
  })
})

// ================================================
// Health Check
// ================================================
app.get('/health', (req, res) => {
  res.json({
    status: "ok",
    whatsapp: client.info ? "connected" : "connecting"
  })
})

// ================================================
// Inicializar servidor
// ================================================
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`)
})

// iniciar whatsapp
client.initialize()
