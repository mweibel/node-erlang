/**
 * Crypto contains functions for generating challenges/digests.
 */
'use strict';

let crypto = require('crypto');

/**
 * A challenge is a 32 bit integer number in big endian order.
 * @returns {Number}
 */
exports.generateChallenge = function generateChallenge() {
  return crypto.randomBytes(32).readUInt32BE(0, true);
};

/**
 * A digest is a (16 bytes) MD5 hash of the Challenge (as text) concatenated with the cookie (as text).
 *
 * @param {Number} challenge
 * @param {String} cookie
 * @returns {String}
 */
exports.digest = function digest(challenge, cookie) {
  let hash = crypto.createHash('md5');
  hash.update(cookie + challenge, 'utf8');
  return hash.digest();
};
