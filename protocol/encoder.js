/**
 * Encoder is used for sending packets to another
 * distributed erlang node.
 */
'use strict'

let constants = require('./constants')
const erlang = require('erlang_js').Erlang

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
  // let tuple = bert.tuple(6, bert.pid(bert.atom('server1'), 1, 0, 1), cookie, nodeName)
  let tuple = [
    6,
    new erlang.OtpErlangPid(new erlang.OtpErlangAtom('server1', false), 1, 0, 1),
    new erlang.OtpErlangAtom(cookie),
    new erlang.OtpErlangAtom(nodeName)
  ]
  let ctrlMsg = erlang._term_to_binary(tuple)
  let ctrlMsgLen = Buffer.byteLength(ctrlMsg, 'utf8')

  // let msg = bert.encode(bert.tuple(bert.atom('$gen_cast'), bert.tuple('init_connect')))
  // let msgLen = Buffer.byteLength(ctrlMsg, 'utf8')

  let buf = new Buffer(ctrlMsgLen /*+ msgLen*/)
  let offset = 0
  ctrlMsg.copy(buf, offset)
  // offset += ctrlMsgLen + 1
  // msg.copy(buf, offset)

  return messageWrapper(distributionHeader(buf))
}
