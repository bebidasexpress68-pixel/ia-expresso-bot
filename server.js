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
      '--disable-gpu',
      '--single-process'
    ]
  }
})

// ================================================
// QR CODE
// ================================================
client.on('qr', async (qr) => {

  console.log("📱 QR recebido")

  qrImage = await QRCode.toDataURL(qr)

})

// ================================================
// CONECTADO
// ================================================
client.on('ready', () => {

  console.log("✅ WhatsApp conectado!")

})

// ================================================
// DESCONECTADO
// ================================================
client.on('disconnected', (reason) => {

  console.log("❌ WhatsApp desconectado:", reason)

  client.initialize()

})

// ================================================
// RECEBER MENSAGENS
// ================================================
client.on('message', async (msg) => {

  try {

    if (msg.fromMe) return

    if (msg.from.includes('@g.us')) return

    const text = msg.body || ""

    console.log("📩 Mensagem recebida:", text)

    await msg.reply("🤖 Bot funcionando!")

  } catch (err) {

    console.log("Erro ao responder:", err)

  }

})

// ================================================
// PAGINA QR
// ================================================
app.get('/qr', (req, res) => {

  if (!qrImage) {

    return res.send("QR ainda não gerado")

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
// HEALTH CHECK
// ================================================
app.get('/health', (req, res) => {

  res.json({
    status: "ok",
    whatsapp: client.info ? "connected" : "connecting"
  })

})

// ================================================
// SERVER
// ================================================
const PORT = process.env.PORT || 8080

app.listen(PORT, () => {

  console.log("🚀 Servidor rodando na porta", PORT)

})

client.initialize()

// ================================================
// KEEP ALIVE
// ================================================
setInterval(() => {

  console.log("🟢 Servidor ativo")

}, 30000)
