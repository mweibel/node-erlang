'use strict';

let net = require('net');
let os = require('os');
let debug = require('debug')('node-erlang:example-server');
let client = require('epmd-client');
let Server = require('../');

const EPMD_PORT = 4369;

class TestServer {
  constructor(name, host, port) {
    this.name = name;
    this.host = host;
    this.port = port;
  }

  listen(cb) {
    debug('listen ' + this.name);
    this.server = net.createServer(this._onConnect.bind(this));
    this.server.on('data', this._onData.bind(this));
    this.server.listen(this.port, this.host);

    // setup an epmd client in order to register
    // itself with the name & port
    this.epmdClient = new client.Client(this.host, EPMD_PORT);

    this.epmdClient.on('connect', function() {
      // register port & name on epmd
      this.epmdClient.register(this.port, this.name);
    }.bind(this));

    if(cb) {
      this.epmdClient.on('alive', cb);
    }

    // finally connect for real to epmd
    this.epmdClient.connect();
  }

  getNode(host, name, cookie) {
    // in order to get the port of another node
    // we need a new connection
    // because on an ALIVE socket you're not supposed to send anything else.
    let self = this;
    client.getNode(host, 4369, name, function(err, node) {
      if(err) {
        console.error(err);
        return;
      }
      console.log(node.data.name + ' listens on port ' + node.data.port);

      let srv = new Server(self.name, self.host, cookie);
      srv.on('connect', function() {
        debug('connected');

        srv.register();
      });
      srv.on('end', function() {
        debug('ended :(');
      });
      srv.connect(host, node.data.port);
    });
  }

  _onData(data) {
    debug('recv', data);
  }

  _onConnect(c) {
    debug('client connected');
    c.on('end', this._onClientEnd.bind(this));
    c.on('data', this._onClientData.bind(this));
  }

  _onClientData(data) {
    debug('recv', data);
  }

  _onClientEnd() {
    debug('client disconnected');
  }
}

module.exports = TestServer;
