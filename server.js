require('dotenv').config()

const express = require('express')
const { Client, LocalAuth } = require('whatsapp-web.js')

const app = express()

// =============================
// WHATSAPP
// =============================
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "ia-expresso"
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  }
})

// =============================
// QR
// =============================
client.on('qr', (qr) => {

  console.log("ESCANEIE O QR")

})

// =============================
// CONECTADO
// =============================
client.on('ready', () => {

  console.log("WHATSAPP CONECTADO")

})

// =============================
// MENSAGEM
// =============================
client.on('message', async msg => {

  console.log("MENSAGEM:", msg.body)

  if(msg.fromMe) return

  await msg.reply("Bot funcionando!")

})

// =============================
// SERVER
// =============================
app.listen(8080, () => {

  console.log("Servidor rodando")

})

client.initialize()
