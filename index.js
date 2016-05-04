/**
 * Connect to an erlang node through a defined
 * host/port combination.
 */
'use strict'

let os = require('os')
let net = require('net')
let EventEmitter = require('events').EventEmitter
let debug = require('debug')('node-erlang')
let send = require('debug')('node-erlang:send')
let recv = require('debug')('node-erlang:recv')
let handshakeConstants = require('./handshake/constants')
let crypto = require('./handshake/crypto')
let handshakeEncoder = require('./handshake/encoder')
let handshakeDecoder = require('./handshake/decoder')
let encoder = require('./protocol/encoder')
let decoder = require('./protocol/decoder')
let constants = require('./protocol/constants')

/**
 * A Server instance can handle one connection to an Erlang node.
 *
 * @emits connect When connection is fully established and handshake was successful.
 * @emits end When connection ended.
 */
class Server extends EventEmitter {
  /**
   * Instantiates a new server which connects to the specified
   * host/port combination.
   *
   * @param {String} nodeName This server's nodeName
   * @param {String} [host=os.hostname()] This server's host
   * @param {String} cookie Erlang cookie. Needs to be the same as on the target host.
   */
  constructor (nodeName, host, cookie) {
    super()

    host = host || os.hostname()
    this.fullNodeName = nodeName + '@' + host
    this.cookie = cookie
    this.challenge = crypto.generateChallenge()
    this.state = 'WaitForStatus'
    this.remoteNodeName = null
  }

  /**
   * Connect to the specified host & port.
   * @param {String} host
   * @param {Number} port
   */
  connect (host, port) {
    debug('Connecting to %s:%s', host, port)
    this.host = host
    this.port = port

    this.conn = net.connect({
      host: host,
      port: port
    })
    this.conn.on('connect', this._onConnect.bind(this))
    this.conn.on('data', this._onData.bind(this))
    this.conn.on('end', this._onEnd.bind(this))
  }

  register () {
    debug('Sending registration')
    this._send(encoder.buildSendReg(this.cookie, this.remoteNodeName))
  }

  _send (buf) {
    send('> %s', buf.inspect())
    this.conn.write(buf)
  }

  /**
   * Handles TCP connection established
   * @private
   */
  _onConnect () {
    debug('Connected to %s:%s', this.host, this.port)

    debug('Initiating handshake, sending nodeName.')
    this._send(handshakeEncoder.sendName(handshakeConstants.VERSION, this.fullNodeName))
  }

  /**
   * Handles data received from the TCP connection.
   * @param {Buffer} buf
   * @private
   */
  _onData (buf) {
    recv('< %s', buf.inspect())
    try {
      this['_handle' + this.state](buf)
    } catch (e) {
      debug('Error: %s', e)
      this.conn.end()
      this.emit('error', e)
    }
  }

  /**
   * Handles WaitForStatus state which will parse a status packet from the remote node
   * and if everything ok, transition into 'WaitForChallenge' state.
   * @param {Buffer} buf
   * @private
   */
  _handleWaitForStatus (buf) {
    // will throw an error if status doesn't begin with 'ok'
    let status = handshakeDecoder.recvStatus(buf)
    if (status === 'ok' || status === 'ok_simultaneous') {
      this.state = 'WaitForChallenge'
    } else {
      this.conn.end()
    }
  }

  /**
   * Handles WaitForChallenge state which will parse a challenge packet, and if everything is ok,
   * send a challenge reply.
   *
   * @param {Buffer} buf
   * @private
   */
  _handleWaitForChallenge (buf) {
    let obj = handshakeDecoder.recvChallenge(buf)
    debug('Received Challenge reply: %j', obj)

    this.remoteNodeName = obj.nodeName

    this.state = 'WaitForChallengeAck'
    this._send(handshakeEncoder.sendChallengeReply(obj.challenge, this.challenge, this.cookie))
  }

  /**
   * Handles WaitForChallengeAck state which will parse the challenge ack packet and if everything is ok,
   * emit the 'connected' event.
   *
   * @param {Buffer} buf
   * @private
   */
  _handleWaitForChallengeAck (buf) {
    handshakeDecoder.recvChallengeAck(buf, this.challenge, this.cookie)
    this.state = 'Connected'
    this.emit('connect')
  }

  /**
   * As soon as the handshake is complete, the protocol changes to be slightly different.
   * This function Handles the connected protocol.
   * @param {Buffer} buf
   * @private
   */
  _handleConnected (buf) {
    decoder.decode(buf, (err, msg) => {
      if (err) {
        debug('error received: %s', err)
        return
      }
      if (!msg) {
        debug('msg not found')
        return
      }
      switch (msg.type) {
        case constants.TYPE_KEEPALIVE:
          debug('received keepalive, echoing back')
          this._send(encoder.buildkeepAlive())
          break
        default:
          debug('msg %s not implemented yet', msg.type)
      }
    })
  }

  /**
   * Handler for TCP connection ended
   * @private
   */
  _onEnd () {
    debug('Connection to %s:%s ended', this.host, this.port)
    this.emit('end')
  }
}

module.exports = Server
