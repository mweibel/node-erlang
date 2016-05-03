/**
 * Encoder is used for sending packets to another
 * distributed erlang node.
 */
'use strict'

let constants = require('./constants')
const erlang = require('erlang')

function messageWrapper (req) {
  let baseLength = 4
  let buf = new Buffer(baseLength + req.length)
  buf.writeUInt32BE(req.length, 0)
  req.copy(buf, baseLength, 0)

  return buf
}

exports.sendKeepAlive = function sendKeepAlive () {
  return messageWrapper(new Buffer(0))
}

function distributionHeader (req) {
  let numAtomCacheRefs = 0
  let baseLength = 3
  let buf = new Buffer(baseLength + req.length)
  let offset = 0
  buf.writeUInt8(constants.VERSION, offset)
  offset += 1
  buf.writeUInt8(constants.TAG_DISTRIBUTION_HEADER, offset)
  offset += 1
  buf.writeUInt8(numAtomCacheRefs, offset)

  req.copy(buf, baseLength, 0)

  return buf
}

exports.sendReg = function sendReg (cookie, nodeName) {
  let ctrlMsg = erlang.term_to_binary({
    tuple: [
      6,
      {
        pid: {
          node: {atom: 'server1'},
          id: 1,
          serial: 0,
          creation: 0
        }
      },
      {atom: cookie},
      {atom: nodeName}
    ]
  })

  // strip off the VERSION_MAGIC. Not sure why it's even there.
  ctrlMsg = ctrlMsg.slice(1)
  const ctrlMsgLen = Buffer.byteLength(ctrlMsg, 'binary')

  let msg = erlang.term_to_binary({
    tuple: [
      {atom: '$gen_cast'},
      {tuple: [
        {atom: 'init_connect'},
        {tuple: [
          5,
          110
        ]},
        {atom: 'server1'},
        {tuple: [
          {atom: 'locker'},
          {atom: 'no_longer_a_pid'},
          null,
          {pid: {
            node: 'server1',
            id: 1,
            serial: 0,
            creation: 0
          }}
        ]}
      ]}
    ]
  })
  // strip off the VERSION_MAGIC. Not sure why it's even there.
  msg = msg.slice(1)
  const msgLen = Buffer.byteLength(msg, 'binary')

  let buf = new Buffer(ctrlMsgLen + msgLen)
  let offset = 0
  ctrlMsg.copy(buf, offset)
  offset += ctrlMsgLen + 1
  msg.copy(buf, offset)

  return messageWrapper(distributionHeader(buf))
}
