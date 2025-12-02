import { WebSocketServer } from "ws";
import chalk from "chalk";
import { getConnection } from "./config/rabbit.js"; // ajusta o caminho se precisar

const SOCKET_PORT = Number(process.env.SOCKET_PORT ?? 8081);

// definimos as duas salas/exchanges suportadas
const EXCHANGES = ["sala_aula", "sala_trabalho"];

const websocket = new WebSocketServer({ port: SOCKET_PORT });

// Canal global pro Rabbit, pra consumir E publicar
let rabbitChannel = null;

function broadcastJson(payload) {
    const message = JSON.stringify(payload);
    websocket.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}

// --- Bridge RabbitMQ <-> WebSocket ---
async function setupRabbitWebsocketBridge() {
    try {
        const channel = await getConnection();
        rabbitChannel = channel;
        // cria ambos exchanges fanout
        for (const ex of EXCHANGES) {
            await channel.assertExchange(ex, "fanout", { durable: true });
        }

        console.log(
            chalk.green(
                `[Rabbit] WebSocket bridge pronto. Exchanges: ${EXCHANGES.join(", ")}`
            )
        );
    } catch (err) {
        console.error(chalk.red("[Rabbit] Erro no bridge Rabbit -> WS:"), err);
    }
}

setupRabbitWebsocketBridge();

// helper pra publicar no exchange
// publica em um exchange específico
function publishToRabbit(exchange, payload) {
    if (!rabbitChannel) {
        console.warn("[Rabbit] Canal ainda não pronto, ignorando mensagem:", payload);
        return;
    }

    if (!EXCHANGES.includes(exchange)) {
        console.warn("[Rabbit] Exchange desconhecido:", exchange);
        return;
    }

    rabbitChannel.publish(exchange, "", Buffer.from(JSON.stringify(payload)));
}

// --- WebSocket ---

websocket.on("connection", (ws) => {
    console.log(chalk.cyan("Cliente conectado.."));
    // cada cliente mantém referência à sua fila de consumo e sala atual
    ws._rabbitQueue = null;
    ws._room = null;

    ws.on("message", (raw) => {
        const text = raw.toString();
        console.log(chalk.yellow("Do client:"), text);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.log("Mensagem não é JSON válido, ignorando.");
            return;
        }

        // 👉 AGORA: nada de broadcast direto.
        // Tudo que vier do client vai pra fila.

        // esperamos que cliente envie também o campo `room` indicando a sala
        if (data.type === "join" && data.name && data.room) {
            ws.userName = data.name;
            const room = String(data.room);

            // se já havia uma fila anterior, limpa
            if (ws._rabbitQueue) {
                try {
                    rabbitChannel.cancel(ws._rabbitQueue.consumerTag).catch(() => {});
                } catch {}
                ws._rabbitQueue = null;
            }

            // cria fila exclusiva e faz bind no exchange da sala
            (async () => {
                try {
                    const q = await rabbitChannel.assertQueue("", {
                        exclusive: true,
                        durable: false,
                        autoDelete: true,
                    });

                    if (!EXCHANGES.includes(room)) {
                        console.warn("Sala desconhecida pedida pelo cliente:", room);
                    }

                    await rabbitChannel.bindQueue(q.queue, room, "");

                    const consumeOk = await rabbitChannel.consume(
                        q.queue,
                        (msg) => {
                            if (!msg) return;
                            let payload;
                            try {
                                payload = JSON.parse(msg.content.toString());
                            } catch {
                                rabbitChannel.ack(msg);
                                return;
                            }
                            payload = payload.payload ?? payload;

                            // envia apenas para este cliente
                            try {
                                ws.send(JSON.stringify(
                                    payload.type === "join" && payload.name
                                        ? { type: "system", text: `${payload.name} entrou no chat` }
                                        : payload.type === "leave" && payload.name
                                            ? { type: "system", text: `${payload.name} saiu do chat` }
                                            : payload.type === "message" && payload.name && payload.text
                                                ? { type: "message", name: payload.name, text: payload.text }
                                                : payload
                                ));
                            } catch (e) {
                                // ignore send errors
                            }

                            rabbitChannel.ack(msg);
                        },
                        { noAck: false }
                    );

                    ws._rabbitQueue = { name: q.queue, consumerTag: consumeOk.consumerTag };
                    ws._room = room;

                    console.log(chalk.green(`[Rabbit] Cliente bindado na sala "${room}" fila "${q.queue}"`));
                } catch (err) {
                    console.error("Erro ao preparar fila do cliente:", err);
                }
            })();

            // publica evento join apenas na sala escolhida
            publishToRabbit(data.room, {
                type: "join",
                name: data.name,
            });

            return;
        }

        if (data.type === "message" && data.name && data.text && data.room) {
            // publica no exchange da sala indicada
            publishToRabbit(data.room, {
                type: "message",
                name: data.name,
                text: data.text,
            });

            return;
        }

        console.log("Tipo de mensagem desconhecido vindo do client:", data);
    });

    ws.on("close", () => {
        console.log(chalk.gray("Cliente desconectado."));
        if (ws.userName) {
            // publica leave na sala do cliente, se existir
            if (ws._room) {
                publishToRabbit(ws._room, {
                    type: "leave",
                    name: ws.userName,
                });
            }
        }
        // tenta cancelar consumo e remover fila
        if (ws._rabbitQueue && rabbitChannel) {
            try {
                rabbitChannel.cancel(ws._rabbitQueue.consumerTag).catch(() => {});
            } catch {}
            ws._rabbitQueue = null;
        }
    });
});

console.log(chalk.greenBright(`WebSocket rodando na porta ${SOCKET_PORT}...`));
