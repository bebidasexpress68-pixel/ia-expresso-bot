require("dotenv").config()

const express = require("express")
const cors = require("cors")

const {
default: makeWASocket,
useMultiFileAuthState,
DisconnectReason
} = require("@whiskeysockets/baileys")

const P = require("pino")

const app = express()

app.use(cors())
app.use(express.json())

// ======================================
// WHATSAPP
// ======================================

async function startWhatsApp() {

const { state, saveCreds } = await useMultiFileAuthState("auth")

const sock = makeWASocket({
auth: state,
printQRInTerminal: true,
logger: P({ level: "silent" })
})

sock.ev.on("creds.update", saveCreds)

sock.ev.on("connection.update", (update) => {

const { connection } = update

if (connection === "open") {

console.log("✅ WhatsApp conectado!")

}

if (connection === "close") {

console.log("❌ Conexão fechada, reconectando...")

startWhatsApp()

}

})

// ======================================
// RECEBER MENSAGENS
// ======================================

sock.ev.on("messages.upsert", async ({ messages }) => {

const msg = messages[0]

if (!msg.message) return

const text =
msg.message.conversation ||
msg.message.extendedTextMessage?.text ||
""

const from = msg.key.remoteJid

console.log("📩 Mensagem:", text)

await sock.sendMessage(from, {
text: "🤖 Bot funcionando!"
})

})

}

startWhatsApp()

// ======================================
// SERVER
// ======================================

app.listen(8080, () => {

console.log("🚀 Servidor rodando na porta 8080")

})
