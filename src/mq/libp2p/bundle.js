'use strict';

const bluebird = require('bluebird');

const libp2p = require('libp2p');
bluebird.Promise.promisifyAll(libp2p.prototype);

const TCP = require('libp2p-tcp');
const Multiplex = require('libp2p-multiplex');
const SECIO = require('libp2p-secio');
const MulticastDNS = require('libp2p-mdns');
const KadDHT = require('libp2p-kad-dht');

class Bundle extends libp2p {
  constructor (peerInfo) {
    const modules = {
      transport: [new TCP()],
      connection: {
        muxer: [Multiplex],
        // crypto: [SECIO]
      },
      discovery: [new MulticastDNS(peerInfo, { interval: 2000 })],
      // we add the DHT module that will enable Peer and Content Routing
      DHT: KadDHT
    };
    super(modules, peerInfo);
  }
}

module.exports = Bundle;
