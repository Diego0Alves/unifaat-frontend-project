import { WebSocketServer } from "ws";
import express from "express";
import chalk from "chalk";

const app = express();
app.use(express.json());

const SOCKET_PORT = Number(process.env.SOCKET_PORT ?? 8081);
const SOCKET_NOTIFY_PORT = Number(process.env.SOCKET_NOTIFY_PORT ?? 3001);

const wss = new WebSocketServer({ port: SOCKET_PORT });

// --- helpers de broadcast ---

function broadcastString(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}

function broadcastJson(payload) {
    const message = JSON.stringify(payload);
    broadcastString(message);
}

// endpoint interno para workers notificarem o WebSocket
app.post("/notify", (req, res) => {
    const message = req.body;
    console.log(message);
    // se vier string crua, manda do jeitinho que veio
    if (typeof message === "string") {
        broadcastString(message);
    } else if (message) {
        // se vier objeto, manda como JSON
        broadcastJson(message);
    }

    return res.json({ ok: true });
});

app.listen(SOCKET_NOTIFY_PORT, () =>
    console.log(`- Web Notify server rodando na porta ${SOCKET_NOTIFY_PORT}`)
);

// --- WebSocket ---

wss.on("connection", (ws) => {
    console.log(chalk.cyan("Cliente conectado.."));

    ws.on("message", (raw) => {
        const text = raw.toString();
        console.log(chalk.yellow("Do client:"), text);

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.log("Mensagem não é JSON válido, ignorando.");
            return;
        }

        // cliente entrou no chat
        if (data.type === "join" && data.name) {
            // guardar nome no socket (ok em JS)
            ws.userName = data.name;

            broadcastJson({
                type: "system",
                text: `${data.name} entrou no chat`,
            });

            return;
        }

        // mensagem normal de chat
        if (data.type === "message" && data.name && data.text) {
            broadcastJson({
                type: "message",
                name: data.name,
                text: data.text,
            });

            return;
        }

        console.log("Tipo de mensagem desconhecido:", data);
    });

    ws.on("close", () => {
        console.log(chalk.gray("Cliente desconectado."));
        if (ws.userName) {
            broadcastJson({
                type: "system",
                text: `${ws.userName} saiu do chat`,
            });
        }
    });
});

console.log(
    chalk.greenBright(`WebSocket rodando na porta ${SOCKET_PORT}...`)
);
