// ================================================
// IA EXPRESSO — Servidor Principal
// ================================================

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { Client, LocalAuth } = require('whatsapp-web.js')
const QRCode = require('qrcode')

const app = express()

app.use(cors())
app.use(express.json())

// ================================================
// QR Code storage
// ================================================
let qrImage = null

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
// QR Code recebido
// ================================================
client.on('qr', async (qr) => {

  console.log('📱 QR recebido')

  qrImage = await QRCode.toDataURL(qr)

})

// ================================================
// WhatsApp conectado
// ================================================
client.on('ready', () => {

  console.log('✅ WhatsApp conectado!')
  console.log(`Conta: ${client.info.pushname}`)

})

// ================================================
// Reconectar se cair
// ================================================
client.on('disconnected', (reason) => {

  console.log('❌ WhatsApp desconectado:', reason)
  console.log('🔄 Reconectando...')

  client.initialize()

})

// ================================================
// Receber mensagens
// ================================================
client.on('message', async (msg) => {

  if (msg.fromMe) return
  if (msg.from.includes('@g.us')) return

  const text = msg.body.toLowerCase()

  console.log(`📩 ${msg.from}: ${text}`)

  if (text.includes("oi") || text.includes("ola")) {

    msg.reply("🍺 Olá! Bem-vindo à Expresso Bebidas. Como posso ajudar?")

  }

  if (text.includes("cerveja")) {

    msg.reply("Temos várias cervejas 🍺\nHeineken\nBudweiser\nCorona\n\nQual você prefere?")

  }

})

// ================================================
// Página QR
// ================================================
app.get('/qr', (req, res) => {

  if (!qrImage) {

    return res.send("QR ainda não gerado. Reinicie o servidor.")

  }

  res.send(`
    <html>
      <body style="text-align:center;font-family:sans-serif">
        <h2>Escaneie com seu WhatsApp</h2>
        <img src="${qrImage}" />
      </body>
    </html>
  `)

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
