'use strict'

const bluebird = require('bluebird');

const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const FloodSub = require('libp2p-floodsub');
bluebird.Promise.promisifyAll([PeerId, PeerInfo, FloodSub])

const { createNode } = require('./helpers');

const { sleep } = require('../../utils');

class LibP2PSender {
  async setup({ ip, port, brokerIp, brokerPort }) {
    this.node = await createNode(ip, port, require('./id-sender'));

    this.fs = new FloodSub(this.node);
    await this.fs.startAsync();

    console.log('SENDER node started!');
    
    this.brokerId = await PeerId.createFromJSONAsync(require('./id-broker'));
    this.brokerInfo = await PeerInfo.createAsync(this.brokerId);
    this.brokerInfo.multiaddrs.add(`/ip4/${brokerIp}/tcp/${brokerPort}`);

    await this.node.dialAsync(this.brokerInfo);

    // Wait a bit
    await sleep(1000);

    console.log('SENDER node ready!');
  }

  async teardown() {
    await this.node.hangUpAsync();
  }

  send(message) {
    this.fs.publish('test', message);
  }

}

module.exports = LibP2PSender;