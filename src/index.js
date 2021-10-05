import { WebSocketServer } from "ws"
import RedisStreamHelper from "redis-stream-helper"
import crypto from "crypto"

const { listenForMessages, createStreamGroup, addStreamData, addListener } =
  RedisStreamHelper(process.env.REDIS_PORT, process.env.REDIS_HOST)
const wss = new WebSocketServer({ port: 8080 })

function heartbeat() {
  this.isAlive = true
}

await createStreamGroup("transport:ws:trigger")
addListener("transport:ws:trigger")

wss.on("connection", (ws) => {
  ws.isAlive = true
  ws.clientId = crypto.randomUUID()
  ws.on("pong", heartbeat)
  ws.on("message", (message) => {
    console.log("received: %s", message, "from", ws.clientId)
    const payload = JSON.parse(message)
    const messageId = payload.messageId
    if (typeof payload.type !== "string") {
      ws.send(messageId + " - NO TYPE DEFINED")
    } else if (toString.call(payload.data) !== "[object Object]") {
      ws.send(messageId + " - INVALID DATA")
    } else {
      const operations = {
        async stream(payload) {
          const value = payload.data.value
          const key = payload.data.key
          if (
            !Array.isArray(value) ||
            value.length === 0 ||
            value.length % 2 !== 0
          ) {
            ws.send(messageId + " - INVALID VALUE")
          } else {
            if (!value.includes("transport")) {
              value.push("transport", "ws")
              value.push("clientId", ws.clientId)
            }
            console.log("sending: ", value, "to", key, "from", ws.clientId)
            addStreamData(key, value)
            ws.send(messageId + " - STREAM ADD OK")
          }
        },
      }
      if (Object.keys(operations).includes(payload.type)) {
        operations[payload.type](payload)
      } else {
        ws.send(messageId + " - UNKNOWN OPERATION")
      }
    }
  })
})

const run = async () => {
  await listenForMessages(async (key, streamId, data) => {
    console.log("new WS message from stream", key, streamId, data)
    wss.clients.forEach(function each(ws) {
      if (ws.clientId === data.clientId) {
        ws.send("RESULT: " + JSON.stringify(data))
      }
    })
    addStreamData("transport:ws:complete", data)
  })
  run()
}

run()

// this should be handled also on the websocket client

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate()

    ws.isAlive = false
    ws.ping()
  })
}, 30000)

wss.on("close", function close() {
  clearInterval(interval)
})
