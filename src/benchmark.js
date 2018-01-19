'use strict'

process.on('unhandledRejection', function(reason, p) {
  // console.error('Unhandled Rejection:', p, '\nreason:', reason.stack || reason);
  console.error(reason.stack);
});

const crypto = require('crypto');

const yargs = require('yargs');

const { longToUint8Array, uint8ArrayToLong } = require('./utils');

// MQ lib
const libp2pSender = require('./mq/libp2p/sender');
const libp2pBroker = require('./mq/libp2p/broker');
const libp2pReceiver = require('./mq/libp2p/receiver');

const argv = yargs
  .command('uniform', 'start a test in Uniform mode', yargs => {
    yargs
      .option('mq', {
        // alias: 'mq',
        describe: 'message queue lib to use',
        choices: ['libp2p'],
        demandOption: true,
      })
      .option('role', {
        alias: 'r',
        describe: 'node role',
        choices: ['sender', 'broker', 'receiver'],
        demandOption: true,
      })
      .option('messageCount', {
        alias: 'c',
        describe: 'number of messages to send',
        type: 'number',
        default: 1000,
      })
      .option('messageSize', {
        alias: 's',
        describe: 'message size to test in bytes',
        type: 'number',
        default: 1000,
      });
  })
  .command('poisson', 'start a test in Poisson mode', yargs => {
    yargs
      .option('mq', {
        // alias: 'mq',
        describe: 'message queue lib to use',
        choices: ['libp2p'],
        demandOption: true,
      })
      .option('role', {
        alias: 'r',
        describe: 'node role',
        choices: ['sender', 'broker', 'receiver'],
        demandOption: true,
      })
      .option('duration', {
        alias: 'd',
        describe: 'duration to test in minutes',
        type: 'number',
        default: 5,
      });
  })
  .demandCommand(1, 'You need to specifiy a mode to test')
  .help()
  .argv;

const mode = argv._[0];
const mq = argv.mq;
const role = argv.role;
const messageSize = argv.messageSize;
const messageCount = argv.messageCount;
const duration = argv.duration;

let message;
if (mode === 'uniform') {
  message = crypto.randomBytes(messageSize);
}

let Sender;
let Broker;
let Receiver;
switch (mq) {
  case 'libp2p': 
    Sender = libp2pSender;
    Broker = libp2pBroker;
    Receiver = libp2pReceiver;
    break;
  default:
    console.log('Invalid mq lib name');
}

(async () => {
  switch (role) {
    case 'sender': {
      const sender = new Sender();
      await sender.setup({
        ip: '0.0.0.0',
        port: 10001,
        brokerIp: '127.0.0.1',
        brokerPort: 10002,
      });

      if (mode === 'uniform') {
        const messageLength = 8 + message.length;
        for (let i = 0; i < messageCount; i++) {
          const timestampBuf = longToUint8Array(Date.now());
          sender.send(Buffer.concat([timestampBuf, message], messageLength));
        };
      } else if (mode === 'poisson') {
        console.log('Not Implemented');
        process.exit(0);
      }

      break;
    }
    case 'broker': {
      const broker = new Broker();
      await broker.setup({
        ipNetwork1: '0.0.0.0',
        portNetwork1: 10002,
        ipNetwork2: '0.0.0.0',
        portNetwork2: 20001,
        receiverIp: '127.0.0.1',
        receiverPort: 20002,
      });

      break;
    }
    case 'receiver': {
      let startTime = null;
      let messageCounter = 0;
      let latencies = [];

      const receiver = new Receiver();
      await receiver.setup({
        ip: '0.0.0.0',
        port: 20002,
        messageHandler: (msg) => {
          const timestamp = uint8ArrayToLong(msg.data.slice(0, 8));
          latencies.push(Date.now() - timestamp);
          // console.log(msg.from, msg.data.toString())
          
          if (messageCounter === 0) {
            startTime = timestamp;
            console.log('>>> START');
          }

          messageCounter++;

          if (messageCounter === messageCount) {
            console.log('>>> FINISH');
            console.log('Message Received:', messageCounter);
            const sumLatencies = latencies.reduce((a, b) => a + b, 0);
            console.log('Avg Latency:', sumLatencies / latencies.length, 'ms');
            console.log('Time used:', Date.now() - startTime, 'ms');

            startTime = null;
            messageCounter = 0;
            latencies = [];
          }
        }
      });

      break;
    }
    default:
      console.log('Invalid role');
  }
})();
