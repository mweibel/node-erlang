/**
 * ProtocolDecoder is used for decoding packets from a connected erlang node.
 */
'use strict'

const Parser = require('erlang-term-format')
const parser = new Parser()
const BitView = require('bit-buffer').BitView
const debug = require('debug')('node-erlang:protocol:encoder')
let constants = require('./constants')

class ProtocolDecoderError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ProtocolDecoderError'
  }
}
exports.ProtocolDecoderError = ProtocolDecoderError

function readFlag (bv, offset) {
  const bits = bv.getBits(offset, 4, false)

  return {
    isNew: (bits & 8) === 8, // 8 = 1000, so this checks if the left most bit is set
    index: bits >>> 1 // shift one to right, inserting a 0 on LSB, so isNew flag goes away
  }
}
function readFlags (numAtomCache, buf) {
  const bv = new BitView(buf, 0)
  let offset = 0
  let flags = []
  let numFlags = 0

  while (numFlags < numAtomCache) {
    flags.push(readFlag(bv, offset))
    numFlags += 1
    offset += 4
  }

  // 3 + 1 bits left, 3 bits are unused, last bit defines if long atoms are used.
  offset += 3
  const longAtoms = bv.getBits(offset, 1, false) === 1

  return {
    flags: flags,
    longAtoms: longAtoms
  }
}

function readAtomCache (flags, num, buf) {
  let refs = []
  let offset = 0
  let index = 0

  while (index < num) {
    const isNew = flags.flags[index].isNew
    if (!isNew) {
      index += 1
      offset += 1
      continue
    }

    const intSegmentIdx = buf.readUInt8(offset)
    offset += 1

    let len = 0
    if (flags.longAtoms) {
      len = buf.readUInt16BE(offset)
      offset += 2
    } else {
      len = buf.readUInt8(offset)
      offset += 1
    }

    // TODO: encoding can be latin if DFLAG_UTF8_ATOM hasn't been exchanged during handshake.
    refs[index] = {
      atom: buf.toString('utf8', offset, offset + len),
      idx: intSegmentIdx
    }

    offset += len
    index += 1
  }

  return {
    refs: refs,
    len: offset
  }
}

/**
 * Handles a parsed SEND_REG packet.
 *
 * FIXME: Do something with the msg param.
 *
 * @param {Object} ctrlMsg
 * @param {Object} msg
 * @param {Function} onParsed
 */
function handleReg (ctrlMsg, msg, onParsed) {
  const [ , pid, cookie, nodeName ] = ctrlMsg.value.elements

  debug('Received SEND_REG packet')
  onParsed({
    type: constants.TYPE_REGISTRATION,
    pid: pid.value,
    cookie: cookie.value.atom,
    nodeName: nodeName.value.atom
  })
}

/**
 * Handles a parsed MONITOR_P packet.
 *
 * @param {Object}   ctrlMsg
 * @param {Function} onParsed
 */
function handleMonitorProcess (ctrlMsg, onParsed) {
  debug('Received MONITOR_P packet')
  onParsed({
    type: constants.TYPE_MONITOR_PROCESS
  })
}

/**
 * Handles a parsed packet.
 *
 * @param {{data: Object, flags: Object, atomCacheRefs: Object}} packet
 * @param {Function} onParsed
 */
function handleParsed (packet, onParsed) {
  const [ ctrlMsg, msg ] = packet.data
  debug('Parsed control message %j', ctrlMsg)
  debug('Parsed message %j', msg)

  const [ operation ] = ctrlMsg.value.elements
  switch (operation.value) {
    case 6:
      return handleReg(ctrlMsg, msg, onParsed)
    case 19:
      return handleMonitorProcess(ctrlMsg, onParsed)
    default:
      throw new ProtocolDecoderError(`Control message ${operation.value} not implemented.`)
  }
}

/**
 * Decode a packet
 * @param {Buffer}   buf
 * @param {Function} onParsed  Called when decoding is complete
 * @returns {*}
 */
exports.decode = function decode (buf, onParsed) {
  let offset = 0
  const len = buf.readUInt32BE(offset)
  if (len === 0) {
    return onParsed({
      type: constants.TYPE_KEEPALIVE
    })
  }
  offset += 4

  const version = buf.readUInt8(offset)
  offset += 1
  const tag = buf.readUInt8(offset)
  offset += 1
  if (version === constants.VERSION && tag === constants.TAG_DISTRIBUTION_HEADER) {
    // erl distribution protocol
    const numAtomCacheRefs = buf.readUInt8(offset)
    offset += 1
    debug('Number of atom cache refs: %d', numAtomCacheRefs)

    let flags = []
    let atomCacheRefs = []

    if (numAtomCacheRefs > 0) {
      const flagLen = Math.floor(numAtomCacheRefs / 2 + 1)
      debug('Flag length in buffer: %d', flagLen)

      flags = readFlags(numAtomCacheRefs, buf.slice(offset, offset + flagLen))
      offset += Math.floor(numAtomCacheRefs / 2 + 1)
      debug('Number of found flags: %d. Using long atoms: %j', flags.flags.length, flags.longAtoms)

      atomCacheRefs = readAtomCache(flags, numAtomCacheRefs, buf.slice(offset))
      debug('Number of found atom cache refs: %d', atomCacheRefs.refs.length)

      offset += atomCacheRefs.len
    }

    const fullMsg = buf.slice(offset)

    let result = []
    const onReadable = () => {
      result.push(parser.read())
    }
    parser.on('readable', onReadable)

    return parser.write(fullMsg, () => {
      parser.removeListener('readable', onReadable)
      return handleParsed({
        data: result,
        flags: flags,
        atomCacheRefs: atomCacheRefs
      }, onParsed)
    })
  }

  throw new ProtocolDecoderError('Unable to read message')
}
