'use strict'

const bluebird = require('bluebird');

const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const FloodSub = require('libp2p-floodsub');
bluebird.Promise.promisifyAll([PeerId, PeerInfo, FloodSub])

const { createNode } = require('./helpers');

class LibP2PBroker {
  async setup({ ipNetwork1, portNetwork1, ipNetwork2, portNetwork2, receiverIp, receiverPort }) {
    this.nodeNetwork1 = await createNode(ipNetwork1, portNetwork1, require('./id-broker'));
    this.fsNetwork1 = new FloodSub(this.nodeNetwork1);
    await this.fsNetwork1.startAsync();

    this.nodeNetwork2 = await createNode(ipNetwork2, portNetwork2, require('./id-broker'));
    this.fsNetwork2 = new FloodSub(this.nodeNetwork2);
    await this.fsNetwork2.startAsync();

    console.log('BROKER node started!');
    
    this.receiverId = await PeerId.createFromJSONAsync(require('./id-receiver'));
    this.receiverInfo = await PeerInfo.createAsync(this.receiverId);
    this.receiverInfo.multiaddrs.add(`/ip4/${receiverIp}/tcp/${receiverPort}`);

    await this.nodeNetwork2.dialAsync(this.receiverInfo);

    this.fsNetwork1.on('test', (msg) => {
      // console.log(msg.from, msg.data.toString())
      this.fsNetwork2.publish('test', msg.data);
    });
    this.fsNetwork1.subscribe('test');

    this.fsNetwork1.on('signal', (msg) => {
      this.fsNetwork2.publish('signal', msg.data);
    });
    this.fsNetwork1.subscribe('signal');

    console.log('BROKER node ready!');
  }

  async teardown() {
    await this.nodeNetwork1.hangUpAsync();
    await this.nodeNetwork2.hangUpAsync();
  }

}

module.exports = LibP2PBroker;
