'use strict'

process.on('unhandledRejection', function(reason, p) {
  // console.error('Unhandled Rejection:', p, '\nreason:', reason.stack || reason);
  console.error(reason.stack);
});

const crypto = require('crypto');

const yargs = require('yargs')

const bluebird = require('bluebird');

const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const FloodSub = require('libp2p-floodsub');
bluebird.Promise.promisifyAll([PeerId, PeerInfo, FloodSub])

const { sleep, createNode } = require('./helpers');

const argv = yargs
  .command('uniform', 'start a test in Uniform mode', yargs => {
    yargs
      .option('messageCount', {
        alias: 'c',
        describe: 'number of messages to send',
        type: 'number',
        demandOption: true,
      })
      .option('messageSize', {
        alias: 's',
        describe: 'message size to test in bytes',
        type: 'number',
        demandOption: true,
      });
  })
  .command('poisson', 'start a test in Poisson mode', yargs => {
    yargs
      .option('duration', {
        alias: 'd',
        describe: 'duration to test in minutes',
        type: 'number',
        demandOption: true,
      });
  })
  .demandCommand(1, 'You need to specifiy a mode to test')
  .help()
  .argv;

const mode = argv._[0];
const messageSize = argv.messageSize;
const messageCount = argv.messageCount;
const duration = argv.duration;

let message;
if (mode === 'uniform') {
  message = crypto.randomBytes(messageSize);
}

(async () => {
  const node = await createNode('0.0.0.0', 10001);

  const fs = new FloodSub(node);
  await fs.startAsync();

  console.log('Node SENDER ready!');
  
  const peer2Id = await PeerId.createFromJSONAsync(require('./id-2'));
  const peer2Info = await PeerInfo.createAsync(peer2Id);
  peer2Info.multiaddrs.add('/ip4/127.0.0.1/tcp/10002');

  await node.dialAsync(peer2Info);

  // Wait a bit
  await sleep(1000);

  if (mode === 'uniform') {
    const startTimeBuf = new Buffer(`startTime:${Date.now()}`);
    fs.publish('signal', startTimeBuf);

    for (let i = 0; i < messageCount; i++) {
      fs.publish('test', message);
    };

    const endFlagBuf = new Buffer('end');
    fs.publish('signal', endFlagBuf);
  } else if (mode === 'poisson') {
    console.log('Not Implemented');
    process.exit(0);
  }
})();
