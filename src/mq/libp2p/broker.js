'use strict'

const bluebird = require('bluebird');

const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const FloodSub = require('libp2p-floodsub');
bluebird.Promise.promisifyAll([PeerId, PeerInfo, FloodSub]);

const PEER_ID = require('./id-broker');

const { createNode } = require('./helpers');

const { sleep } = require('../../utils');

class LibP2PBroker {
  async setup({ ipNetwork1, portNetwork1, ipNetwork2, portNetwork2, receiverIp, receiverPort }) {
    this.nodeNetwork1 = await createNode(ipNetwork1, portNetwork1, PEER_ID);
    this.fsNetwork1 = new FloodSub(this.nodeNetwork1);
    await this.fsNetwork1.startAsync();

    this.nodeNetwork2 = await createNode(ipNetwork2, portNetwork2, PEER_ID);
    this.fsNetwork2 = new FloodSub(this.nodeNetwork2);
    await this.fsNetwork2.startAsync();

    // console.log('[BROKER]:', 'Started!');
    
    this.nodeNetwork1.on('peer:connect', (peer) => {
      console.log(new Date(), '[BROKER]:', 'SENDER node connected');
      this.senderNodeOnline = true;
    });

    this.nodeNetwork1.on('peer:disconnect', (peer) => {
      console.log(new Date(), '[BROKER]:', 'SENDER node disconnected');
      this.senderNodeOnline = false;
    });

    this.nodeNetwork2.on('peer:connect', (peer) => {
      console.log(new Date(), '[BROKER]:', 'RECEIVER node connected');
      this.receiverNodeOnline = true;
    });

    this.nodeNetwork2.on('peer:disconnect', (peer) => {
      console.log(new Date(), '[BROKER]:', 'RECEIVER node disconnected');
      this.receiverNodeOnline = false;
    });

    // this.fsNetwork1.on('status', (msg) => {
    //   if (msg.from !== PEER_ID.id) {
    //     this.fsNetwork1.publish(
    //       'status',
    //       Buffer.from(JSON.stringify({ receiverNodeOnline: this.receiverNodeOnline }))
    //     );
    //   }
    // });
    // this.fsNetwork1.subscribe('status');

    this.receiverId = await PeerId.createFromJSONAsync(require('./id-receiver'));
    this.receiverInfo = await PeerInfo.createAsync(this.receiverId);
    this.receiverInfo.multiaddrs.add(`/ip4/${receiverIp}/tcp/${receiverPort}`);

    // Try to connect every 5 seconds until successful
    while (true) {
      try {
        await this.nodeNetwork2.dialAsync(this.receiverInfo);

        this.fsNetwork1.on('test', (msg) => {
          // console.log(msg.from, msg.data.toString())
          this.fsNetwork2.publish('test', msg.data);
        });
        this.fsNetwork1.subscribe('test');

        this.fsNetwork1.on('signal', (msg) => {
          if (msg.from !== PEER_ID.id) {
            this.fsNetwork2.publish('signal', msg.data);
          }
        });
        this.fsNetwork1.subscribe('signal');

        this.fsNetwork2.on('signal', (msg) => {
          if (msg.from !== PEER_ID.id) {
            this.fsNetwork1.publish('signal', msg.data);
          }
        });
        this.fsNetwork2.subscribe('signal');

        console.log(new Date(), '[BROKER]:', 'Ready!');

        break;
      } catch (error) {
        // console.warn('Cannot connect to receiver. Retrying');
        await sleep(5000);
      }
    }    
  }

  async teardown() {
    await this.fsNetwork1.stopAsync();
    await this.fsNetwork2.stopAsync();
    await this.nodeNetwork1.stopAsync();
    await this.nodeNetwork2.stopAsync();
  }

}

module.exports = LibP2PBroker;
