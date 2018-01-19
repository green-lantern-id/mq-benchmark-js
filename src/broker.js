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

(async () => {
  const nodeNetwork1 = await createNode('0.0.0.0', 10002);
  const fsNetwork1 = new FloodSub(nodeNetwork1);
  await fsNetwork1.startAsync();

  const nodeNetwork2 = await createNode('0.0.0.0', 20001);
  const fsNetwork2 = new FloodSub(nodeNetwork2);
  await fsNetwork2.startAsync();

  console.log('Node BROKER ready!');
  
  const peer3Id = await PeerId.createFromJSONAsync(require('./id-3'));
  const peer3Info = await PeerInfo.createAsync(peer3Id);
  peer3Info.multiaddrs.add('/ip4/127.0.0.1/tcp/20002');

  await nodeNetwork2.dialAsync(peer3Info);

  fsNetwork1.on('test', (msg) => {
    // console.log(msg.from, msg.data.toString())
    fsNetwork2.publish('test', msg.data);
  });
  fsNetwork1.subscribe('test');

  fsNetwork1.on('signal', (msg) => {
    fsNetwork2.publish('signal', msg.data);
  });
  fsNetwork1.subscribe('signal');

})();
