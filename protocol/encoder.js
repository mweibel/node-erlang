/**
 * Encoder is used for sending packets to another
 * distributed erlang node.
 */
'use strict';

let constants = require('./constants');

function messageWrapper(req) {
  let baseLength = 4;
  let buf = new Buffer(baseLength + req.length);
  buf.writeUInt32BE(req.length, 0);
  req.copy(buf, baseLength, 0);

  return buf;
}

exports.sendKeepAlive = function sendKeepAlive() {
  return messageWrapper(new Buffer(0));
};
