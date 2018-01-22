'use strict';

process.on('unhandledRejection', function(reason, p) {
  // console.error('Unhandled Rejection:', p, '\nreason:', reason.stack || reason);
  console.error(reason.stack);
});

const crypto = require('crypto');

const yargs = require('yargs');

const { longToUint8Array, uint8ArrayToLong, usleep } = require('./utils');

// MQ libs
const libp2pSender = require('./mq/libp2p/sender');
const libp2pBroker = require('./mq/libp2p/broker');
const libp2pReceiver = require('./mq/libp2p/receiver');

const zeromqSender = require('./mq/zeromq/sender');
const zeromqBroker = require('./mq/zeromq/broker');
const zeromqReceiver = require('./mq/zeromq/receiver');

const PoissonObject = require('./poisson');

const argv = yargs
  .command('uniform', 'start a test in Uniform mode', yargs => {
    yargs
      .command('sender', 'sender role', yargs => {
        yargs
          .option('messageCount', {
            alias: 'c',
            describe: 'number of messages to send',
            type: 'number',
            // demandOption: true,
          })
          .option('messageSize', {
            alias: 's',
            describe: 'message size to test in bytes',
            type: 'number',
            demandOption: true,
          })
          .option('delay', {
            describe: 'delay between message transmissions in microseconds (10^-6)',
            type: 'number',
            default: 0,
          })
          .option('duration', {
            alias: 'd',
            describe: 'How long this test last in second (Default: 60000)',
            type: 'number',
            // demandOption: true,
          })
          .option('brokerIp', {
            describe: 'broker node IP address',
            type: 'string',
            demandOption: true,
          });
        // .option('brokerPort', {
        //   describe: 'broker port IP address',
        //   type: 'number',
        //   demandOption: true,
        // });
      })
      .command('broker', 'broker role', yargs => {
        yargs.option('receiverIp', {
          describe: 'receiver node IP address',
          type: 'string',
          demandOption: true,
        })
        // .option('receiverPort', {
        //   describe: 'receiver port IP address',
        //   type: 'number',
        //   demandOption: true,
        // });
        .option('senderIp', {
          describe: 'sender node IP address',
          type: 'string',
          // demandOption: true,
        });
      })
      .command('receiver', 'receiver role', yargs => {
        yargs.option('messageCount', {
          alias: 'c',
          describe: 'expected number of messages to receive',
          type: 'number',
          // demandOption: true,
        })
        .option('brokerIp', {
          describe: 'broker node IP address',
          type: 'string',
          // demandOption: true,
        });
      })
      .demandCommand(1, 'You need to specifiy a role to test');
  })
  .command('poisson', 'start a test in Poisson mode', yargs => {
    yargs
      .command('sender', 'sender role', yargs => {
        yargs
          .option('brokerIp', {
            describe: 'broker node IP address',
            type: 'string',
            demandOption: true,
          })
          .option('avgSize', {
            describe: 'Average message size in Byte',
            type: 'number',
          })
          .option('avgDelay', {
            describe:
              'Average delay between message in microsecond (10^-6) (min 1, max 1000)',
            type: 'number',
          })
          .option('duration', {
            alias: 'd',
            describe:
              'How long this test last in second (Default will send message forever)',
            type: 'number',
          })
          .option('messageCount', {
            alias: 'c',
            describe:
              'Number of messages to send (Default will send message forever)',
            type: 'number',
          })
          .option('messageSize', {
            alias: 's',
            describe:
              'message size to test in bytes (if avgSize is not specified)',
            type: 'number',
          })
          // .option('brokerPort', {
          //   describe: 'broker port IP address',
          //   type: 'number',
          //   demandOption: true,
          // });
          .check(function(argv) {
            if(argv.avgDelay && (argv.avgDelay > 1000 || argv.avgDelay < 1)) return false;
            if(!argv.messageSize && !argv.avgSize) return false;
            if(argv.avgSize && (argv.avgSize < 1024 || argv.avgSize > 1048576)) return false;
            return true;
          }, false);
      })
      .command('broker', 'broker role', yargs => {
        yargs.option('receiverIp', {
          describe: 'receiver node IP address',
          type: 'string',
          demandOption: true,
        });
        // .option('receiverPort', {
        //   describe: 'receiver port IP address',
        //   type: 'number',
        //   demandOption: true,
        // });
      })
      .command('receiver', 'receiver role', yargs => {
        /*yargs.option('messageCount', {
          alias: 'c',
          describe: 'expected number of messages to receive',
          type: 'number',
        })
        .option('duration', {
          alias: 'd',
          describe:
            'How long this test last in second (Default will send message forever)',
          type: 'number',
        });*/
      })
      .demandCommand(1, 'You need to specifiy a role to test');
  })
  .option('mq', {
    // alias: 'mq',
    describe: 'message queue lib to use',
    choices: ['libp2p', 'zeromq'],
    demandOption: true,
  })
  .demandCommand(1, 'You need to specifiy a mode to test')
  .help().argv;

const mode = argv._[0];
const role = argv._[1];
const mq = argv.mq;
const messageSize = argv.messageSize;
const messageCount = argv.messageCount;
const delay = argv.delay;
const duration = argv.duration;
const avgSize = argv.avgSize;
const avgDelay = argv.avgDelay;

let Sender;
let Broker;
let Receiver;
switch (mq) {
  case 'libp2p':
    Sender = libp2pSender;
    Broker = libp2pBroker;
    Receiver = libp2pReceiver;
    break;
  case 'zeromq':
    Sender = zeromqSender;
    Broker = zeromqBroker;
    Receiver = zeromqReceiver;
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
          bindIp: '0.0.0.0',
          bindPort: 10001,
          brokerIp: argv.brokerIp,
          brokerPort: 10002,
        });

        const message = crypto.randomBytes(messageSize);
        const messageLength = 8 + message.length;
        const startTime = Date.now();
        let messageCounter = 0;
        if (messageCount) {
          for (let i = 0; i < messageCount; i++) {
            const timestampBuf = longToUint8Array(Date.now());
            sender.send(Buffer.concat([timestampBuf, message], messageLength));
            messageCounter++;
            if (delay !== 0) {
              await usleep(delay);
            }
          }
        } else if (duration) {
          const durationInSecond = duration * 1000;
          while (Date.now() - startTime < durationInSecond) {
            const timestampBuf = longToUint8Array(Date.now());
            sender.send(Buffer.concat([timestampBuf, message], messageLength));
            messageCounter++;
            if (delay !== 0) {
              await usleep(delay);
            }
          }
        } else {
          console.log('Missing parameter. Need to specify either "messageCount" or "duration".');
          process.exit(0);
        }

        // End message (timestamp = 0)
        const timestampBuf = longToUint8Array(0);
        sender.send(Buffer.concat([timestampBuf], 8));

        const timeUsed = Date.now() - startTime;

        console.log('\n===== TEST RESULT (SENDER) =====');
        console.log('Message Sent:', messageCounter);
        console.log('Time used:', timeUsed, 'ms');
        console.log(
          'Throughput:',
          (messageCount || messageCounter) / timeUsed * 1000,
          'msg/sec'
        );
        console.log('================================\n');

        break;
      }
      case 'broker': {
        const broker = new Broker();
        await broker.setup({
          bindIpNetwork1: '0.0.0.0',
          bindPortNetwork1: 10002,
          bindIpNetwork2: '0.0.0.0',
          bindPortNetwork2: 20001,
          senderIp: argv.senderIp,
          senderPort: 10001,
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
          bindIp: '0.0.0.0',
          bindPort: 20002,
          brokerIp: argv.brokerIp,
          brokerPort: 20001,
          messageHandler: msg => {
            const timestamp = uint8ArrayToLong(msg.slice(0, 8)); // First 8 bytes is timestamp from sender
            if (timestamp > 0) latencies.push(Date.now() - timestamp);
            // console.log(msg.from, msg.data.toString())

            if (messageCounter === 0) {
              startTime = timestamp;
              console.log(new Date(), '>>> START TESTING (First message received)');
            }

            if (timestamp === 0) {
              console.log(new Date(), '>>> FINISH TESTING (Last message received)');
              const sumLatencies = latencies.reduce((a, b) => a + b, 0);
              const timeUsed = Date.now() - startTime;
              
              console.log('\n===== TEST RESULT (RECEIVER) =====');
              console.log('Message Received:', messageCounter);
              console.log('Time used:', timeUsed, 'ms');
              console.log(
                'Avg Latency:',
                sumLatencies / latencies.length,
                'ms'
              );
              console.log(
                'Throughput:',
                messageCounter / timeUsed * 1000,
                'msg/sec'
              );
              console.log('================================\n');

              startTime = null;
              messageCounter = 0;
              latencies = [];
              receiver.signalFinish();
              return;
            }

            messageCounter++;
          },
        });

        break;
      }
      default:
        console.log('Invalid role');
    }
//===========================================================================================
  } else if (mode === 'poisson') {
    switch (role) {
      case 'sender': {
        const sender = new Sender();
        await sender.setup({
          bindIp: '0.0.0.0',
          bindPort: 10001,
          brokerIp: argv.brokerIp,
          brokerPort: 10002,
        });

        if (!avgSize && !avgDelay)
          console.log('\n===\nNo avgSize or avgDelay specified, will behave like uniform.\n===\n');

        const message = crypto.randomBytes(avgSize ? avgSize * 2 : messageSize);
        var randomSize, randomDelay;
        if (avgSize) randomSize = new PoissonObject(avgSize / 1024);
        if (avgDelay) randomDelay = new PoissonObject(avgDelay);
        let timestampBuf,
          messageLength,
          payloadLength,
          startTime = new Date().getTime(),
          counter = messageCount,
          sent = 0,
          sumSize = 0;

        while (true) {
          payloadLength = avgSize ? randomSize.sample() * 1024 : messageSize;
          messageLength = 8 + payloadLength;
          timestampBuf = longToUint8Array(Date.now());

          if (avgDelay) {
            //let sleepTime = randomDelay.sample();
            //let before = process.hrtime();
            await usleep(randomDelay.sample());
            //await usleep(sleepTime)
            //console.log(process.hrtime(before),sleepTime);
          }
          sender.send(
            Buffer.concat(
              [timestampBuf, message.slice(0, payloadLength)],
              messageLength
            )
          );
          sent++;
          sumSize += payloadLength;
          if (counter) {
            if (--counter === 0) break;
          }
          if (duration && duration * 1000 <= Date.now() - startTime) {
            break;
          }
        }

        //last message to tell receiver to stop
        let timeUsed = Date.now() - startTime;
        timestampBuf = longToUint8Array(0);
        sender.send(Buffer.concat([timestampBuf],8));

        console.log('\n===== TEST RESULT (SENDER) =====');
        console.log('Message Sent:', sent);
        console.log('Time used:', timeUsed, 'ms');
        console.log('Data Sent:', sumSize/1024, 'KB');
        console.log(
          'Throughput:',
          sent / timeUsed * 1000,
          'msg/sec'
        );
        console.log(
          'Throughput:',
          (sumSize/1024) / timeUsed * 1000,
          'KB/sec'
        );
        console.log('================================\n');
        break;
      }
      case 'broker': {
        const broker = new Broker();
        await broker.setup({
          bindIpNetwork1: '0.0.0.0',
          bindPortNetwork1: 10002,
          bindIpNetwork2: '0.0.0.0',
          bindPortNetwork2: 20001,
          receiverIp: argv.receiverIp,
          receiverPort: 20002,
        });

        break;
      }
      case 'receiver': {
        let startTime = null;
        let messageCounter = 0;
        let latencies = [];
        let sumSize = 0;

        const receiver = new Receiver();
        await receiver.setup({
          bindIp: '0.0.0.0',
          bindPort: 20002,
          messageHandler: msg => {
            const timestamp = uint8ArrayToLong(msg.slice(0, 8)); // First 8 bytes is timestamp from sender
            if(timestamp > 0) {
              sumSize += msg.length - 8;
              latencies.push(Date.now() - timestamp);
            }

            if (messageCounter === 0) {
              startTime = timestamp;
              console.log(new Date(), '>>> START TESTING');
            }

            if (timestamp === 0) {
              console.log(new Date(), '>>> FINISH TESTING');
              const sumLatencies = latencies.reduce((a, b) => a + b, 0);
              const timeUsed = Date.now() - startTime;
              console.log('\n===== TEST RESULT (RECEIVER) =====');
              console.log('Message Received:', messageCounter);
              console.log('Time used:', timeUsed, 'ms');
              console.log('Data received:', sumSize/1024, 'KB');
              console.log(
                'Avg Latency:',
                sumLatencies / latencies.length,
                'ms'
              );
              console.log(
                'Throughput:',
                messageCounter / timeUsed * 1000,
                'msg/sec'
              );
              console.log('Throughput:', (sumSize/1024) / timeUsed * 1000, 'KB/sec');
              console.log('================================\n');

              startTime = null;
              sumSize = 0;
              messageCounter = 0;
              latencies = [];
              receiver.signalFinish();
              return;
            }
            messageCounter++;
          },
        });

        break;
      }
      default:
        console.log('Invalid role');
    }
  }
})();
