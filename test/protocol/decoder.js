/**
 * Protocol decoder tests
 */
'use strict'

let mocha = require('mocha')
let describe = mocha.describe
let chai = require('chai')
let it = mocha.it

chai.should()

let decoder = require('../../protocol/decoder')
let encoder = require('../../protocol/encoder')
let constants = require('../../protocol/constants')

describe('Protocol decoder', () => {
  it('should decode a keepalive packet', (done) => {
    const keepAlive = encoder.buildkeepAlive()
    decoder.decode(keepAlive, (msg) => {
      msg.should.deep.equal({
        type: constants.TYPE_KEEPALIVE
      })
      done()
    })
  })

  it('should decode a SEND_REG packet', (done) => {
    const packet = encoder.buildSendReg('testcookie', 'testnode')

    decoder.decode(packet, (msg) => {
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
