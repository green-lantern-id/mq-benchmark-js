'use strict'

process.on('unhandledRejection', function(reason, p) {
  // console.error('Unhandled Rejection:', p, '\nreason:', reason.stack || reason);
  console.error(reason.stack);
});

const crypto = require('crypto');

const yargs = require('yargs');

const { longToUint8Array, uint8ArrayToLong } = require('./utils');

// MQ libs
const libp2pSender = require('./mq/libp2p/sender');
const libp2pBroker = require('./mq/libp2p/broker');
const libp2pReceiver = require('./mq/libp2p/receiver');

const argv = yargs
  .command('uniform', 'start a test in Uniform mode', yargs => {
    yargs
      .command('sender', 'sender role', yargs => {
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
          })
          .option('brokerIp', {
            describe: 'broker node IP address',
            type: 'string',
            demandOption: true,
          })
          // .option('brokerPort', {
          //   describe: 'broker port IP address',
          //   type: 'number',
          //   demandOption: true,
          // });
      })
      .command('broker', 'broker role', yargs => {
        yargs
          .option('receiverIp', {
            describe: 'receiver node IP address',
            type: 'string',
            demandOption: true,
          })
          // .option('receiverPort', {
          //   describe: 'receiver port IP address',
          //   type: 'number',
          //   demandOption: true,
          // });
      })
      .command('receiver', 'receiver role', yargs => {
        yargs.option('messageCount', {
          alias: 'c',
          describe: 'expected number of messages to receive',
          type: 'number',
          demandOption: true,
        });
      })
      .demandCommand(1, 'You need to specifiy a role to test');
  })
  .command('poisson', 'start a test in Poisson mode', yargs => {
    yargs
      .command('sender', 'sender role', yargs => {
        yargs
          .option('duration', {
            alias: 'd',
            describe: 'duration to test in minutes',
            type: 'number',
            demandOption: true,
          })
          .option('brokerIp', {
            describe: 'broker node IP address',
            type: 'string',
            demandOption: true,
          })
          // .option('brokerPort', {
          //   describe: 'broker port IP address',
          //   type: 'number',
          //   demandOption: true,
          // });
      })
      .command('broker', 'broker role', yargs => {
        yargs
          .option('receiverIp', {
            describe: 'receiver node IP address',
            type: 'string',
            demandOption: true,
          })
          // .option('receiverPort', {
          //   describe: 'receiver port IP address',
          //   type: 'number',
          //   demandOption: true,
          // });
      })
      .command('receiver', 'receiver role')
      .demandCommand(1, 'You need to specifiy a role to test');
  })
  .option('mq', {
    // alias: 'mq',
    describe: 'message queue lib to use',
    choices: ['libp2p'],
    demandOption: true,
  })
  .demandCommand(1, 'You need to specifiy a mode to test')
  .help()
  .argv;

const mode = argv._[0];
const role = argv._[1];
const mq = argv.mq;
const messageSize = argv.messageSize;
const messageCount = argv.messageCount;
const duration = argv.duration;

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
  if (mode === 'uniform') {
    switch (role) {
      case 'sender': {
        const sender = new Sender();
        await sender.setup({
          ip: '0.0.0.0',
          port: 10001,
          brokerIp: argv.brokerIp,
          brokerPort: 10002,
        });

        const message = crypto.randomBytes(messageSize);
        const messageLength = 8 + message.length;
        for (let i = 0; i < messageCount; i++) {
          const timestampBuf = longToUint8Array(Date.now());
          sender.send(Buffer.concat([timestampBuf, message], messageLength));
        };

        break;
      }
      case 'broker': {
        const broker = new Broker();
        await broker.setup({
          ipNetwork1: '0.0.0.0',
          portNetwork1: 10002,
          ipNetwork2: '0.0.0.0',
          portNetwork2: 20001,
          receiverIp: argv.receiverIp,
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
            const timestamp = uint8ArrayToLong(msg.data.slice(0, 8)); // First 8 bytes is timestamp from sender
            latencies.push(Date.now() - timestamp);
            // console.log(msg.from, msg.data.toString())
            
            if (messageCounter === 0) {
              startTime = timestamp;
              console.log(new Date(), '>>> START TESTING');
            }

            messageCounter++;

            if (messageCounter === messageCount) {
              console.log(new Date(), '>>> FINISH TESTING');
              console.log('Message Received:', messageCounter);
              const sumLatencies = latencies.reduce((a, b) => a + b, 0);
              const timeUsed = Date.now() - startTime;
              console.log('Time used:', timeUsed, 'ms');
              console.log('Avg Latency:', sumLatencies / latencies.length, 'ms');
              console.log('Throughput:', (messageCount / timeUsed) * 1000, 'msg/sec');
              console.log();

              startTime = null;
              messageCounter = 0;
              latencies = [];
              receiver.signalFinish();
            }
          }
        });

        break;
      }
      default:
        console.log('Invalid role');
    }
  } else if (mode === 'poisson') {
    console.log('Not Implemented');
  }
})();
