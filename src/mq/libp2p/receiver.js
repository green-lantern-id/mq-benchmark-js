'use strict';

const bluebird = require('bluebird');

const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const FloodSub = require('libp2p-floodsub');
bluebird.Promise.promisifyAll([PeerId, PeerInfo, FloodSub]);

const PEER_ID = require('./id-receiver');

const { createNode } = require('./helpers');

class LibP2PReceiver {
  async setup({ ip, port, messageHandler }) {
    this.node = await createNode(ip, port, PEER_ID);

    this.fs = new FloodSub(this.node);
    await this.fs.startAsync();

    // console.log(new Date(), '[RECEIVER]:', 'Started!');

    this.fs.on('test', messageHandler);
    this.fs.subscribe('test');

    console.log(new Date(), '[RECEIVER]:', 'Ready!');
  }

  async teardown() {
    await this.fs.stopAsync();
    await this.node.stopAsync();
  }

  signalFinish() {
    this.fs.publish('signal', Buffer.from('finish'));
  }

}

module.exports = LibP2PReceiver;
