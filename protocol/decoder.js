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

  while(numFlags < numAtomCache) {
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

  do {
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
  } while (index < num)

  return {
    refs: refs,
    len: offset
  }
}

exports.decode = function decode (buf) {
  let offset = 0
  const len = buf.readUInt32BE(offset)
  if (len === 0) {
    return {
      type: constants.TYPE_KEEPALIVE
    }
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

    const flagLen = Math.floor(numAtomCacheRefs / 2 + 1)
    debug('Flag length in buffer: %d', flagLen)

    const flags = readFlags(numAtomCacheRefs, buf.slice(offset, offset + flagLen))
    offset += Math.floor(numAtomCacheRefs / 2 + 1)

    debug('Number of found flags: %d. Using long atoms: %j', flags.flags.length, flags.longAtoms)

    const atomCacheRefs = readAtomCache(flags, numAtomCacheRefs, buf.slice(offset))

    debug('Number of found atom cache refs: %d', atomCacheRefs.refs.length)

    //console.log(buf.slice(offset+atomCacheRefs.len));

    let ctrlMsg;
    let msg;

    let fullMsg = buf.slice(offset + atomCacheRefs.len)

    let result = []
    parser.on('readable', () => {
      result.push(parser.read())
    })

    //console.log(fullMsg)
    parser.write(fullMsg)

    const util = require('util')
    console.log("decoded: ", util.inspect(result, {depth: null}))

    return {
      type: constants.TYPE_DISTRIBUTION_PROTOCOL,
      flags: flags
    }
  }

  throw new ProtocolDecoderError('Unable to read message')
}
