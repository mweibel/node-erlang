/**
 * Connect to an erlang node through a defined
 * host/port combination.
 */
'use strict';

let os = require('os');
let net = require('net');
let EventEmitter = require('events').EventEmitter;
let debug = require('debug')('node-erlang');
let constants = require('./handshake/constants');
let crypto = require('./handshake/crypto');
let encoder = require('./handshake/encoder');
let decoder = require('./handshake/decoder');

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
  constructor(nodeName, host, cookie) {
    host = host || os.hostname();
    this.fullNodeName = nodeName + '@' + host;
    this.cookie = cookie;
    this.challenge = crypto.generateChallenge();
    this.state = 'WaitForStatus';
  }

  /**
   * Connect to the specified host & port.
   * @param {String} host
   * @param {Number} port
   */
  connect(host, port) {
    debug('Connecting to %s:%s', host, port);
    this.host = host;
    this.port = port;

    this.conn = net.connect({
      host: host,
      port: port
    });
    this.conn.on('connect', this._onConnect.bind(this));
    this.conn.on('data', this._onData.bind(this));
    this.conn.on('end', this._onEnd.bind(this));
  }

  _send(buf) {
    debug('> %s', buf.inspect());
    this.conn.write(encoder.messageWrapper(buf));
  }

  /**
   * Handles TCP connection established
   * @private
   */
  _onConnect() {
    debug('Connected to %s:%s', this.host, this.port);

    debug('Initiating handshake, sending nodeName.');
    this._send(encoder.sendName(constants.VERSION, this.fullNodeName));
  }

  /**
   * Handles data received from the TCP connection.
   * @param {Buffer} buf
   * @private
   */
  _onData(buf) {
    debug('< %s', buf.inspect());
    try {
      this['_handle' + this.state](buf);
    } catch(e) {
      debug('Error: %s', e);
      this.conn.end();
      this.emit('error', e);
    }
  }

  /**
   * Handles WaitForStatus state which will parse a status packet from the remote node
   * and if everything ok, transition into 'WaitForChallenge' state.
   * @param {Buffer} buf
   * @private
   */
  _handleWaitForStatus(buf) {
    // will throw an error if status doesn't begin with 'ok'
    let status = decoder.recvStatus(buf);
    if(status === 'ok' || status === 'ok_simultaneous') {
      this.state = 'WaitForChallenge';
    } else {
      this.conn.end();
    }
  }

  /**
   * Handles WaitForChallenge state which will parse a challenge packet, and if everything is ok,
   * send a challenge reply.
   *
   * @param {Buffer} buf
   * @private
   */
  _handleWaitForChallenge(buf) {
    let obj = decoder.recvChallenge(buf);
    debug('Received Challenge reply: %j', obj);

    this.state = 'WaitForChallengeAck';
    this._send(encoder.sendChallengeReply(obj.challenge, this.challenge, this.cookie));
  }

  /**
   * Handles WaitForChallengeAck state which will parse the challenge ack packet and if everything is ok,
   * emit the 'connected' event.
   *
   * @param {Buffer} buf
   * @private
   */
  _handleWaitForChallengeAck(buf) {
    decoder.recvChallengeAck(buf, this.challenge, this.cookie);
    this.state = 'Connected';
    this.emit('connect');
  }

  /**
   * As soon as the handshake is complete, the protocol changes to be slightly different.
   * This function Handles the connected protocol.
   * @param {Buffer} buf
   * @private
   */
  _handleConnected(buf) {

  }

  /**
   * Handler for TCP connection ended
   * @private
   */
  _onEnd() {
    debug('Connection to %s:%s ended', this.host, this.port);
    this.emit('end');
  }
}

module.exports = Server;
