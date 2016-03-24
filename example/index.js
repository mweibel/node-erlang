/**
 * Created by michael on 17.03.15.
 */
'use strict'

let debug = require('debug')('node-erlang:example')
let TestServer = require('./server')

function getRandom (min, max) {
  return Math.floor((Math.random() * max) + min)
}

debug('initializing')

let s1 = new TestServer('server1', 'localhost', getRandom(1024, 10024))

s1.listen(function () {
  s1.getNode('localhost', 'testerlang', 'asdf2')
})
