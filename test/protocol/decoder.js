/**
 * Protocol decoder tests
 */
'use strict'

const mocha = require('mocha')
const describe = mocha.describe
const chai = require('chai')
const expect = chai.expect
const it = mocha.it

chai.should()

const decoder = require('../../protocol/decoder')
const encoder = require('../../protocol/encoder')
const constants = require('../../protocol/constants')

describe('Protocol decoder', () => {
  it('should decode a keepalive packet', (done) => {
    const keepAlive = encoder.buildkeepAlive()
    decoder.decode(keepAlive, (err, msg) => {
      expect(err).to.equal(null)

      msg.should.deep.equal({
        type: constants.TYPE_KEEPALIVE
      })
      done()
    })
  })

  it('should throw a ProtocolDecoderError if an invalid packet is received', (done) => {
    const packet = new Buffer([0, 0, 0, 1, 0, 0])

    decoder.decode(packet, (err) => {
      expect(err).to.not.equal(null)
      err.should.be.an.instanceOf(decoder.ProtocolDecoderError)
      done()
    })
  })

  it('should throw a ProtocolDecoderError if a buggy packet is received', (done) => {
    const packet = new Buffer([0, 0, 0, 1, 131, 68, 0, 0])

    decoder.decode(packet, (err) => {
      expect(err).to.not.equal(null)
      err.should.be.an.instanceOf(decoder.ProtocolDecoderError)
      done()
    })
  })

  it('should decode a SEND_REG packet', (done) => {
    const packet = encoder.buildSendReg('testcookie', 'testnode')

    decoder.decode(packet, (err, msg) => {
      expect(err).to.equal(null)

      msg.should.deep.equal({
        type: constants.TYPE_REGISTRATION,
        cookie: 'testcookie',
        nodeName: 'testnode',
        pid: {
          creation: 0,
          id: 1,
          serial: 0,
          node: {
            name: 'atom',
            value: {
              atom: 'server1',
              len: 7
            }
          }
        }
      })
      done()
    })
  })
})
