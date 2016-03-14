/**
 * Decoder is used for receiving & parsing packets from another
 * distributed erlang node.
 */
'use strict';

let util = require('util');
let crypto = require('./crypto');

class DecoderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DecoderError';
  }
}
exports.DecoderError = DecoderError;

/**
 * Status response
 * @param {Buffer} buf
 *
 * @returns {String}
 */
exports.recvStatus = function recvStatus(buf) {
  let offset = 0;
  let len = buf.readUInt16BE(offset);
  if(len !== (buf.length - 2) || len < 3) {
    throw new DecoderError('RECV_STATUS Invalid buffer length');
  }
  offset += 2;
  let tag = buf.toString('utf8', offset, offset + 1);
  if(tag !== 's') {
    throw new DecoderError(util.format('RECV_STATUS incorrect tag. Expected "s" got "%s".', tag));
  }
  offset += 1;
  let status = buf.toString('utf8', offset);
  let statusOk = status.substr(0, 2);
  if(statusOk !== 'ok') {
    throw new DecoderError('RECV_STATUS non-ok response code: ', status);
  }
  return status;
};

/**
 * Recv challenge
 * @param {Buffer} buf
 * @returns {{version: Number, flags: Number, challenge: Number, nodeName: String}}
 */
exports.recvChallenge = function recvChallenge(buf) {
  let offset = 0;
  let len = buf.readUInt16BE(offset);
  if(len !== (buf.length - 2) || len <= 13) {
    throw new DecoderError('RECV_CHALLENGE Invalid buffer length');
  }
  offset += 2;
  let tag = buf.toString('utf8', offset, offset + 1);
  if(tag !== 'n') {
    throw new DecoderError(util.format('RECV_CHALLENGE incorrect tag. Expected "n" got "%s".', tag));
  }
  offset += 1;
  let version = buf.readUInt16BE(offset);
  offset += 2;
  let flags = buf.readUInt32BE(offset);
  offset += 4;
  let challenge = buf.readUInt32BE(offset);
  offset += 4;
  let nodeName = buf.toString('utf8', offset);

  return {
    version: version,
    flags: flags,
    challenge: challenge,
    nodeName: nodeName
  };
};

/**
 * Now A has generated a digest and its own challenge. Those are sent together in a package to B.
 * @param {Buffer} buf
 * @param {Number} expectedChallenge
 * @param {String} cookie
 * @returns {Number}
 */
exports.recvChallengeReply = function recvChallengeReply(buf, expectedChallenge, cookie) {
  let offset = 0;
  let len = buf.readUInt16BE(offset);
  if(len !== (buf.length - 2) || len <= 3) {
    throw new DecoderError('RECV_CHALLENGE_REPLY Invalid buffer length');
  }
  offset += 2;
  let tag = buf.toString('utf8', offset, offset + 1);
  if(tag !== 'r') {
    throw new DecoderError(util.format('RECV_CHALLENGE_REPLY incorrect tag. Expected "r" got "%s".', tag));
  }
  offset += 1;
  let challenge = buf.readUInt32BE(offset);
  offset += 4;
  let digest = buf.slice(offset);
  let expectedDigest = crypto.digest(expectedChallenge, cookie);
  if(!digest.equals(expectedDigest)) {
    throw new DecoderError(util.format('RECV_CHALLENGE_REPLY invalid challenge received. ' +
    'Expected "%s", actual "%s', digest.toString(), expectedChallenge.toString()));
  }
  return challenge;
};

/**
 * B checks that the digest received from A is correct and generates
 * a digest from the challenge received from A.
 * The digest is then sent to A.
 *
 * @param {Buffer} buf
 * @param {Number} expectedChallenge Challenge to match with the received challenge.
 * @param {String} cookie
 *
 * @returns {boolean} reply was correct.
 * @throws DecoderError
 */
exports.recvChallengeAck = function recvChallengeAck(buf, expectedChallenge, cookie) {
  let offset = 0;
  let len = buf.readUInt16BE(offset);
  if(len !== (buf.length - 2) || len <= 3) {
    throw new DecoderError('RECV_CHALLENGE_ACK Invalid buffer length');
  }
  offset += 2;
  let tag = buf.toString('utf8', offset, offset + 1);
  if(tag !== 'a') {
    throw new DecoderError(util.format('RECV_CHALLENGE_ACK incorrect tag. Expected "a" got "%s".', tag));
  }
  offset += 1;
  let challenge = buf.slice(offset);
  let expectedDigest = crypto.digest(expectedChallenge, cookie);
  if(!challenge.equals(expectedDigest)) {
    throw new DecoderError(util.format('RECV_CHALLENGE_ACK invalid challenge received. ' +
    'Expected "%s", actual "%s', challenge.toString(), expectedChallenge.toString()));
  }
  return true;
};
