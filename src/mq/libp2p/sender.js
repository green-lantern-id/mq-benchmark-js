'use strict';

const bluebird = require('bluebird');

const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const FloodSub = require('libp2p-floodsub');
bluebird.Promise.promisifyAll([PeerId, PeerInfo, FloodSub]);

const PEER_ID = require('./id-sender');

const { createNode } = require('./helpers');

const { sleep } = require('../../utils');

class LibP2PSender {
  async setup({ bindIp, bindPort, brokerIp, brokerPort }) {
    this.node = await createNode(bindIp, bindPort, PEER_ID);

    this.fs = new FloodSub(this.node);
    await this.fs.startAsync();

    // console.log('[SENDER]:', 'Started!');
    
    this.node.on('peer:connect', (peer) => {
      console.log(new Date(), '[SENDER]:', 'BROKER node connected');
    });

    this.node.on('peer:disconnect', (peer) => {
      console.log(new Date(), '[SENDER]:', 'BROKER node disconnected');
      // this.connect();
    });

    this.brokerId = await PeerId.createFromJSONAsync(require('./id-broker'));
    this.brokerInfo = await PeerInfo.createAsync(this.brokerId);
    this.brokerInfo.multiaddrs.add(`/ip4/${brokerIp}/tcp/${brokerPort}`);

    // Try to connect every 5 seconds until successful
    while (true) {
      try {
        await this.node.dialAsync(this.brokerInfo);

        this.fs.on('signal', async (msg) => {
          const dataStr = msg.data.toString();
          if (dataStr === 'finish') {
            await this.teardown();

            console.log(new Date(), '[SENDER]:', 'Finish benchmarking.');

            // Somehow there is still a opened connection after calling teardown
            // Need to explicitly exit the process
            process.exit(0);
          }
        });
        this.fs.subscribe('signal');

        // Wait a bit
        await sleep(1000);

        console.log(new Date(), '[SENDER]:', 'Ready!');

        break;
      } catch (error) {
        // console.warn('Cannot connect to broker. Retrying');
        await sleep(5000);
      }
    }

    // this.fs.on('status', (msg) => {
    //   if (msg.from !== PEER_ID.id) {
    //     console.log('status reply:', JSON.parse(msg.data.toString()));
    //   }
    // });
    // this.fs.subscribe('status');
    
    // this.fs.publish('status');
  }

  async teardown() {
    await this.fs.stopAsync();
    await this.node.stopAsync();
  }

  send(message) {
    this.fs.publish('test', message);
  }

}

module.exports = LibP2PSender;