'use strict'

process.on('unhandledRejection', function(reason, p) {
  // console.error('Unhandled Rejection:', p, '\nreason:', reason.stack || reason);
  console.error(reason.stack);
});

const bluebird = require('bluebird');

const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const FloodSub = require('libp2p-floodsub');
bluebird.Promise.promisifyAll([PeerId, PeerInfo, FloodSub])

const { createNode } = require('./helpers');

let startTime;
let messageCounter = 0;

(async () => {
  const node = await createNode('0.0.0.0', 20002);

  const fs = new FloodSub(node);
  await fs.startAsync();

  console.log('Node RECEIVER ready!');

  fs.on('test', (msg) => {
    // console.log(msg.from, msg.data.toString())
    messageCounter++;
  });
  fs.subscribe('test');

  fs.on('signal', (msg) => {
    const msgStr = msg.data.toString();
    const [flag, time] = msgStr.split(':');
    if (flag === 'startTime') {
      startTime = parseInt(time);
      console.log('>>> START');
    } else if (flag === 'end') {
      console.log('>>> FINISH');
      console.log('Message Received:', messageCounter);
      console.log('Time used:', Date.now() - startTime, 'ms');
      messageCounter = 0;
    }
  });
  fs.subscribe('signal');

})();
