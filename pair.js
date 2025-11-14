const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");

function removeFile(FilePath) {
  if (fs.existsSync(FilePath)) {
    fs.rmSync(FilePath, { recursive: true, force: true });
  }
}

router.get("/", async (req, res) => {
  const num = (req.query.number || "").replace(/[^0-9]/g, "");
  if (!num) {
    return res.status(400).send({ code: "Invalid number" });
  }

  async function RobinPair() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    try {
      const RobinPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
      });

      // Request pairing code if not registered
      if (!RobinPairWeb.authState.creds.registered) {
        await delay(1500);
        const code = await RobinPairWeb.requestPairingCode(num);
        if (!res.headersSent) {
          res.send({ code });
        }
      }

      RobinPairWeb.ev.on("creds.update", saveCreds);

      RobinPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection === "open") {
          try {
            await delay(10000);

            const authPath = "./session/";
            const userJid = jidNormalizedUser(RobinPairWeb.user.id);

            function randomMegaId(length = 6, numberLength = 4) {
              const chars =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
              let result = "";
              for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              const number = Math.floor(Math.random() * Math.pow(10, numberLength));
              return `${result}${number}`;
            }

            const megaUrl = await upload(
              fs.createReadStream(authPath + "creds.json"),
              `${randomMegaId()}.json`
            );

            const stringSession = megaUrl.replace("https://mega.nz/file/", "");

            const sid = `*GHOST MD [The MOST powerful WHATSAPP BOT]*\n\n👉 ${stringSession} 👈\n\n*This is your Session ID, copy this id and paste into config.js file*\n\n*Do not share this ID with anyone!*`;
            const warning = `🛑 *Do not share this code. If you share this session id your WhatsApp account can be stolen* 🛑`;

            await RobinPairWeb.sendMessage(userJid, {
              image: {
                url: "https://thumbs.dreamstime.com/b/halloween-ghost-clipart-background-ghost-silhouette-halloween-ghost-logo-isolated-white-background-vector-template-halloween-330896848.jpg",
              },
              caption: sid,
            });

            await RobinPairWeb.sendMessage(userJid, { text: stringSession });
            await RobinPairWeb.sendMessage(userJid, { text: warning });
          } catch (e) {
            console.error("Error sending session:", e);
            exec("pm2 restart prabath");
          } finally {
            await delay(100);
            removeFile("./session");
          }
        } else if (
          connection === "close" &&
          lastDisconnect?.error?.output?.statusCode !== 401
        ) {
          console.warn("Connection closed, retrying...");
          await delay(10000);
          RobinPair(); // retry once
        }
      });
    } catch (err) {
      console.error("Error in RobinPair:", err);
      exec("pm2 restart Robin-md");
      removeFile("./session");
      if (!res.headersSent) {
        res.send({ code: "Service Unavailable" });
      }
    }
  }

  return RobinPair();
});

process.on("uncaughtException", (err) => {
  console.error("Caught exception:", err);
  exec("pm2 restart Robin");
});

module.exports = router;
