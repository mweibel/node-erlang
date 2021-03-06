/**
 * Encoder tests
 */
'use strict'

require('chai').should()

let mocha = require('mocha')
let sinon = require('sinon')
let describe = mocha.describe
let it = mocha.it

let encoder = require('../../handshake/encoder')
let constants = require('../../handshake/constants')
let crypto = require('../../handshake/crypto')

describe('Handshake encoder', function () {
  describe('#sendName()', function () {
    it('should create a valid SEND_NAME packet', function () {
      let version = constants.VERSION
      let fullNodeName = 'test@testhost'
      let nodeNameLen = Buffer.byteLength(fullNodeName)
      let buf = encoder.sendName(version, fullNodeName)

      buf.length.should.equal(2 + 7 + nodeNameLen)
      buf.readUInt16BE(0).should.equal(7 + nodeNameLen)
      buf.toString('utf8', 2, 3).should.equal('n')
      buf.readUInt16BE(3).should.equal(version)
      buf.readUInt32BE(5).should.equal(229373)
      buf.toString('utf8', 9).should.equal(fullNodeName)
    })
  })

  describe('#sendStatus()', function () {
    it('should create a valid SEND_STATUS packet', function () {
      let status = 'ok'
      let statusLen = Buffer.byteLength(status)
      let buf = encoder.sendStatus(status)

      buf.length.should.equal(2 + 1 + statusLen)
      buf.readUInt16BE(0).should.equal(1 + statusLen)
      buf.toString('utf8', 2, 3).should.equal('s')
      buf.toString('utf8', 3).should.equal(status)
    })
  })

  let challenge = 42
  sinon.stub(crypto, 'generateChallenge').returns(challenge)

  describe('#sendChallenge()', function () {
    it('should create a valid SEND_CHALLENGE packet', function () {
      let name = 'test'

      let buf = encoder.sendChallenge(name)
      let baseLen = 2
      buf.length.should.equal(baseLen + 4 + Buffer.byteLength(name))
      buf.readUInt32BE(baseLen).should.equal(challenge)
      buf.toString('utf8', baseLen + 4).should.equal(name)
    })
  })

  describe('#sendChallengeReply()', function () {
    it('should create a valid SEND_CHALLENGE_REPLY packet', function () {
      let cookie = 'testcookie'
      let sendChallenge = 43
      let buf = encoder.sendChallengeReply(challenge, 43, cookie)

      buf.length.should.equal(2 + 1 + 4 + 16)
      buf.readUInt16BE(0).should.equal(1 + 4 + 16)
      buf.toString('utf8', 2, 3).should.equal('r')
      buf.readUInt32BE(3).should.equal(sendChallenge)
      buf.slice(7).equals(crypto.digest(challenge, cookie)).should.equal(true)
    })
  })

  describe('#sendChallengeAck()', function () {
    it('should create a valid SEND_CHALLENGE_ACK packet', function () {
      let cookie = 'testcookie'
      let challenge = 42
      let buf = encoder.sendChallengeAck(challenge, cookie)

      buf.length.should.equal(2 + 1 + 16)
      buf.readUInt16BE(0).should.equal(1 + 16)
      buf.toString('utf8', 2, 3).should.equal('a')
      buf.slice(3).equals(crypto.digest(challenge, cookie)).should.equal(true)
    })
  })
})
