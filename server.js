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
      '--disable-gpu'
    ]
  }
})

// ================================================
// QR recebido
// ================================================
client.on('qr', async (qr) => {

  console.log("📱 QR recebido")

  qrImage = await QRCode.toDataURL(qr)

})

// ================================================
// WhatsApp conectado
// ================================================
client.on('ready', () => {

  console.log("✅ WhatsApp conectado!")

})

// ================================================
// Reconectar se cair
// ================================================
client.on('disconnected', (reason) => {

  console.log("❌ WhatsApp desconectado:", reason)

  client.initialize()

})

// ================================================
// RECEBER MENSAGENS
// ================================================
client.on('message_create', async (msg) => {

  if (msg.fromMe) return
  if (msg.from.includes('@g.us')) return

  const now = Math.floor(Date.now() / 1000)

  if (now - msg.timestamp > 60) return

  console.log("📩 Mensagem recebida:", msg.body)

  msg.reply("Mensagem recebida 👍")

})

// ================================================
// Página QR
// ================================================
app.get('/qr', (req, res) => {

  if (!qrImage) {
    return res.send("QR ainda não gerado.")
  }

  res.send(`
  <html>
  <body style="text-align:center;font-family:sans-serif">
  <h2>Escaneie com seu WhatsApp</h2>
  <img src="${qrImage}">
  </body>
  </html>
  `)

})

// ================================================
// Health
// ================================================
app.get('/health', (req, res) => {

  res.json({
    status: "ok"
  })

})

// ================================================
// Servidor
// ================================================
const PORT = process.env.PORT || 8080

app.listen(PORT, () => {

  console.log("🚀 Servidor rodando na porta", PORT)

})

client.initialize()

// ================================================
// Keep Alive Railway
// ================================================
setInterval(() => {

  console.log("🟢 Servidor ativo")

}, 30000)
