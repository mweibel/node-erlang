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
let constants = require('../../protocol/constants')

describe('Protocol decoder', () => {
  it('should decode a keepalive packet', (done) => {
    const keepAlive = new Buffer([0, 0, 0, 0])
    decoder.decode(keepAlive, (msg) => {
      msg.should.deep.equal({
        type: constants.TYPE_KEEPALIVE
      })
      done()
    })
  })
})
