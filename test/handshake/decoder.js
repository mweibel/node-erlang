/**
 * Encoder tests
 */
'use strict';

let mocha = require('mocha');
let describe = mocha.describe;
let chai = require('chai');
let expect = chai.expect;
let should = chai.should();
let it = mocha.it;

let decoder = require('../../handshake/decoder');
let encoder = require('../../handshake/encoder');
let constants = require('../../handshake/constants');

describe('decoder', function() {
  describe('#recvStatus()', function() {
    it('should decode a valid RECV_STATUS "ok" packet', function() {
      let buf = encoder.sendStatus('ok');
      decoder.recvStatus(buf).should.equal('ok');
    });

    it('should throw a DecoderError if packet length doesn\'t match', function() {
      let buf = new Buffer(42);
      expect(function() {
        decoder.recvStatus(buf);
      }).to.throw(decoder.DecoderError);
    });

    it('should throw a DecoderError if packet is not with tag "s"', function() {
      let tag = new Buffer('fok');
      let buf = encoder.messageWrapper(tag);
      expect(function() {
        decoder.recvStatus(buf);
      }).to.throw(decoder.DecoderError);
    });

    it('should throw a DecoderError if status does not begin with "ok"', function() {
      let buf = encoder.sendStatus('nok');
      expect(function() {
        decoder.recvStatus(buf);
      }).to.throw(decoder.DecoderError);
    });
  });

  // copied from SEND_NAME & SEND_CHALLENGE
  function sendChallengeWithName(fullNodeName, version, challenge) {
    let buf = new Buffer(11 + Buffer.byteLength(fullNodeName));
    let offset = 0;
    buf.write('n', offset);
    offset += 1;
    buf.writeUInt16BE(version, offset);
    offset += 2;

    let flags = constants.FLAG_EXPORT_PTR_TAG;
    flags |= constants.FLAG_EXTENDED_PIDS_PORTS;
    flags |= constants.FLAG_EXTENDED_REFERENCES;
    flags |= constants.FLAG_DIST_MONITOR;
    flags |= constants.FLAG_FUN_TAGS;
    flags |= constants.FLAG_DIST_MONITOR_NAME;
    flags |= constants.FLAG_HIDDEN_ATOM_CACHE;
    flags |= constants.FLAG_NEW_FUN_TAGS;
    flags |= constants.FLAG_BIT_BINARIES;
    flags |= constants.FLAG_NEW_FLOATS;
    flags |= constants.FLAG_UNICODE_IO;
    flags |= constants.FLAG_DIST_HDR_ATOM_CACHE;
    flags |= constants.FLAG_SMALL_ATOM_TAGS;
    flags |= constants.FLAG_UTF8_ATOMS;
    flags |= constants.FLAG_MAP_TAG;

    buf.writeUInt32BE(flags, offset);
    offset += 4;
    buf.writeUInt32BE(challenge, offset);
    offset += 4;
    buf.write(fullNodeName, offset);
    return encoder.messageWrapper(buf);
  }

  describe('#recvChallenge()', function() {
    it('should decode a valid RECV_CHALLENGE packet', function() {
      let fullNodeName = 'test@testhost';
      let version = constants.VERSION;
      let challenge = 42;

      let sendBuf = sendChallengeWithName(fullNodeName, version, challenge);

      let obj = decoder.recvChallenge(sendBuf);
      obj.version.should.equal(constants.VERSION);
      obj.flags.should.equal(229372);
      obj.challenge.should.equal(42);
      obj.nodeName.should.equal(fullNodeName);
    });

    it('should throw a DecoderError if packet length doesn\'t match', function() {
      let buf = new Buffer(42);
      expect(function() {
        decoder.recvChallenge(buf);
      }).to.throw(decoder.DecoderError);
    });

    it('should throw a DecoderError if packet is not with tag "n"', function() {
      let tag = new Buffer(14);
      tag.write('f');
      let buf = encoder.messageWrapper(tag);
      expect(function() {
        decoder.recvChallenge(buf);
      }).to.throw(decoder.DecoderError);
    });
  });

  describe('#recvChallengeReply()', function() {
    it('should return a challenge on a valid RECV_CHALLENGE_REPLY packet', function() {
      let recvChallenge = 42;
      let challenge = 42;
      let cookie = 'test';
      let buf = encoder.sendChallengeReply(recvChallenge, challenge, cookie);
      decoder.recvChallengeReply(buf, challenge, cookie).should.equal(challenge);
    });

    it('should throw a DecoderError if packet length doesn\'t match', function() {
      let buf = new Buffer(42);
      expect(function() {
        decoder.recvChallengeReply(buf, 1, 'b');
      }).to.throw(decoder.DecoderError);
    });

    it('should throw a DecoderError if packet is not with tag "r"', function() {
      let tag = new Buffer(4);
      tag.write('f');
      let buf = encoder.messageWrapper(tag);
      expect(function() {
        decoder.recvChallengeReply(buf, 1, 'b');
      }).to.throw(decoder.DecoderError);
    });

    it('should throw a DecoderError if digest doesn\'t match', function() {
      let recvChallenge = 43;
      let challenge = 42;
      let cookie = 'test';
      let buf = encoder.sendChallengeReply(recvChallenge, challenge, cookie);
      expect(function() {
        decoder.recvChallengeReply(buf, challenge, cookie);
      }).to.throw(decoder.DecoderError);
    });
  });

  describe('#recvChallengeAck()', function() {
    it('should return true on a valid RECV_CHALLENGE_ACK packet', function() {
      let recvChallenge = 42;
      let challenge = 42;
      let cookie = 'test';
      let buf = encoder.sendChallengeAck(recvChallenge, cookie);
      decoder.recvChallengeAck(buf, challenge, cookie).should.equal(true);
    });

    it('should throw a DecoderError if packet length doesn\'t match', function() {
      let buf = new Buffer(42);
      expect(function() {
        decoder.recvChallengeAck(buf, 1, 'b');
      }).to.throw(decoder.DecoderError);
    });

    it('should throw a DecoderError if packet is not with tag "a"', function() {
      let tag = new Buffer(4);
      tag.write('f');
      let buf = encoder.messageWrapper(tag);
      expect(function() {
        decoder.recvChallengeAck(buf, 1, 'b');
      }).to.throw(decoder.DecoderError);
    });

    it('should throw a DecoderError if challenge doesn\'t match', function() {
      let recvChallenge = 43;
      let challenge = 42;
      let cookie = 'test';
      let buf = encoder.sendChallengeAck(recvChallenge, cookie);
      expect(function() {
        decoder.recvChallengeAck(buf, challenge, cookie);
      }).to.throw(decoder.DecoderError);
    });
  });
});
