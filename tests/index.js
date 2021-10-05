import { test } from "uvu"
import * as assert from "uvu/assert"
import WebSocket from "ws"
import crypto from "crypto"

const ws = new WebSocket("ws://localhost:8080")

test.before(async () => {
  await new Promise((res) => ws.on("open", res))
})

const sendWS = (input) =>
  new Promise((res) => {
    input.messageId = crypto.randomUUID()
    ws.send(JSON.stringify(input))
    ws.on("message", (msg) => {
      const message = msg.toString()
      if (message.startsWith(input.messageId)) {
        res(message)
      }
    })
  })

test("should fail if the operation does not exist", async () => {
  assert.match(await sendWS({ type: "foo" }), "INVALID DATA")
})

test("should fail if payload data is not sent or is not a object", async () => {
  assert.match(await sendWS({ type: "stream" }), "INVALID DATA")
  assert.match(await sendWS({ type: "stream", data: null }), "INVALID DATA")
  assert.match(await sendWS({ type: "stream", data: [] }), "INVALID DATA")
  assert.match(await sendWS({ type: "stream", data: "" }), "INVALID DATA")
})

test("should fail if the operation is stream and the value is not a array with length divisible by 2(key-values)", async () => {
  assert.match(
    await sendWS({
      type: "stream",
      data: { key: "global:process:trigger", value: ["name"] },
    }),
    "INVALID VALUE"
  )
  assert.match(
    await sendWS({
      type: "stream",
      data: { key: "global:process:trigger", value: ["name", "value", "foo"] },
    }),
    "INVALID VALUE"
  )
  assert.match(
    await sendWS({
      type: "stream",
      data: { key: "global:process:trigger", value: [] },
    }),
    "INVALID VALUE"
  )
  assert.match(
    await sendWS({
      type: "stream",
      data: { key: "global:process:trigger", value: "test" },
    }),
    "INVALID VALUE"
  )
})

test("create a process", async () => {
  const wsMsg = sendWS({
    type: "stream",
    data: {
      key: "global:process:trigger",
      value: [
        "name",
        "foobar",
        "steps",
        JSON.stringify(["http", "db", "email"]),
      ],
    },
  })
  assert.match(await wsMsg, "STREAM ADD OK")
})

test("execute an atom", async () => {
  const wsMsg = sendWS({
    type: "stream",
    data: {
      key: "atom:http:trigger",
      value: ["key1", "value1", "key2", "value2"],
    },
  })
  assert.match(await wsMsg, "STREAM ADD OK")
})

test("execute a process", async () => {
  const wsMsg = sendWS({
    type: "stream",
    data: {
      key: "process:trigger",
      value: ["name", "foobar", "payload", "blablabla"],
    },
  })
  assert.match(await wsMsg, "STREAM ADD OK")
})

test.after(() => {
  ws.close()
})

test.run()
