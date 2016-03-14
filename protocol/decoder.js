/**
 * ProtocolDecoder is used for decoding packets from a connected erlang node.
 */
'use strict';

let constants = require('./constants');

class ProtocolDecoderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProtocolDecoderError';
  }
}
exports.ProtocolDecoderError = ProtocolDecoderError;

exports.decode = function decode(buf) {
  let offset = 0;
  let len = buf.readUInt32BE(offset);
  if(len === 0) {
    return {
      type: constants.TYPE_KEEPALIVE
    };
  }
  offset += 4;
  let header = buf.readUInt32BE(offset);
};
