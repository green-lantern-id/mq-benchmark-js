'use strict';

process.on('unhandledRejection', function(reason, p) {
  // console.error('Unhandled Rejection:', p, '\nreason:', reason.stack || reason);
  console.error(reason.stack);
});

const fs = require('fs');
const path = require('path');
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
  .option('resultFilepath', {
    describe: 'filepath to write results to (default: same directory as benchmark.js "./mq_result.txt")',
    default: './mq_result.txt',
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
const resultFilepath = argv.resultFilepath;

const benchmarkDetails = {
  mq,
  distribution: mode,
  messageCount,
  messageSize,
  duration,
  delay,
  avgSize,
  avgDelay,
};

const printSenderResult = (result) => {
  console.log('\n===== TEST RESULT (SENDER) =====');
  console.log('Message sent:', result.messageCounter);
  console.log('Time used:', result.timeUsed, 'ms');
  console.log('Data sent:', result.dataSent, 'KiB');
  console.log(
    'Throughput:',
    result.throughput,
    'msg/sec'
  );
  console.log(
    'Throughput:',
    result.throughputKiB,
    'KiB/sec'
  );
  console.log('================================\n');
};

const printReceiverResult = (result) => {
  console.log('\n===== TEST RESULT (RECEIVER) =====');
  console.log('Message received:', result.messageCounter);
  console.log('Time used:', result.timeUsed, 'ms');
  console.log('Data received:', result.dataReceived, 'KiB');
  console.log(
    'Avg latency:',
    result.avgLatency,
    'ms'
  );
  console.log(
    'Throughput:',
    result.throughput,
    'msg/sec'
  );
  console.log('Throughput:', result.throughputKiB, 'KiB/sec');
  console.log('================================\n');
};

const getBenchmarkResultString = ({ datetime, benchmarkDetails, senderResult, receiverResult, withLatencies }) => {
  const datetimeStr = (new Date(datetime)).toString();
  
  let otherBenchmarkDetailsStr = '';
  if (benchmarkDetails.messageCount) otherBenchmarkDetailsStr += `Message count: ${benchmarkDetails.messageCount}\n`;
  if (benchmarkDetails.messageSize) otherBenchmarkDetailsStr += `Message size: ${benchmarkDetails.messageSize} bytes\n`;
  if (benchmarkDetails.duration) otherBenchmarkDetailsStr += `Duration: ${benchmarkDetails.duration} seconds\n`;
  if (benchmarkDetails.delay) otherBenchmarkDetailsStr += `Delay between sending messages: ${benchmarkDetails.delay} microseconds\n`;
  if (benchmarkDetails.avgSize) otherBenchmarkDetailsStr += `Average message size: ${benchmarkDetails.avgSize} bytes\n`;
  if (benchmarkDetails.avgDelay) otherBenchmarkDetailsStr += `Average delay between sending messages: ${benchmarkDetails.avgDelay} microseconds\n`;

  let latenciesStr = '';
  if (withLatencies) {
    latenciesStr = `\nLatencies (ms):\n${receiverResult.latencies}\n`;
  }

  const messageLossCount = senderResult.messageCounter - receiverResult.messageCounter;
  const messageLossPercent = messageLossCount / senderResult.messageCounter * 100;

  const benchmarkResultStr = `===== MQ BENCHMARK RESULT =====
${datetimeStr}

MQ: ${benchmarkDetails.mq}
Distribution: ${benchmarkDetails.distribution}
${otherBenchmarkDetailsStr}
***** SENDER *****
Message sent: ${senderResult.messageCounter}
Time used: ${senderResult.timeUsed} ms
Data sent: ${senderResult.dataSent} KiB
Throughput: ${senderResult.throughput} msg/sec
Throughput: ${senderResult.throughputKiB} KiB/sec

***** RECEIVER *****
Message received: ${receiverResult.messageCounter}
Message loss: ${messageLossCount} (${messageLossPercent}%)
Time used: ${receiverResult.timeUsed} ms
Data received: ${receiverResult.dataReceived} KiB
Avg latency: ${receiverResult.avgLatency} ms
Throughput: ${receiverResult.throughput} msg/sec
Throughput: ${receiverResult.throughputKiB} KiB/sec
${latenciesStr}
========================
`;

  return benchmarkResultStr;
};

const appendResultToFile = ({ filepath, datetime, benchmarkDetails, senderResult, receiverResult }) => {
  const stringToWrite = getBenchmarkResultString({
    datetime,
    benchmarkDetails,
    senderResult,
    receiverResult,
    withLatencies: true,
  });

  try {
    fs.appendFileSync(path.resolve(__dirname, filepath), `${stringToWrite}\n`);
  } catch (err) {
    console.error('Error appending result to file', err);
  }
};

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
  
  switch (role) {
    case 'sender': {
      const sender = new Sender();
      await sender.setup({
        bindIp: '0.0.0.0',
        bindPort: 10001,
        brokerIp: argv.brokerIp,
        brokerPort: 10002,
      });

      const receiverResultPromise = new Promise(r => sender.once('result', (result) => r(result)));

      let messageCounter = 0;
      let sumSize = 0;
      const startTime = Date.now();

      if (mode === 'uniform') { // Uniform

        const message = crypto.randomBytes(messageSize);
        const messageLength = 8 + message.length;
        
        if (messageCount) {
          for (let i = 0; i < messageCount; i++) {
            const timestampBuf = longToUint8Array(Date.now());
            sender.send(Buffer.concat([timestampBuf, message], messageLength));
            messageCounter++;
            sumSize += messageLength;
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
            sumSize += messageLength;
            if (delay !== 0) {
              await usleep(delay);
            }
          }
        } else {
          console.log('Missing parameter. Need to specify either "messageCount" or "duration".');
          process.exit(0);
        }

      } else if (mode === 'poisson') { // Poisson distribution

        if (!avgSize && !avgDelay)
          console.log('\n===\nNo avgSize or avgDelay specified, will behave like uniform.\n===\n');

        const message = crypto.randomBytes(avgSize ? avgSize * 2 : messageSize);
        var randomSize, randomDelay;
        if (avgSize) randomSize = new PoissonObject(avgSize / 1024);
        if (avgDelay) randomDelay = new PoissonObject(avgDelay);
        let timestampBuf,
          messageLength,
          payloadLength,
          counter = messageCount;

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
          messageCounter++;
          sumSize += messageLength;
          if (counter) {
            if (--counter === 0) break;
          }
          if (duration && duration * 1000 <= Date.now() - startTime) {
            break;
          }
        }
      }

      // End message (timestamp = 0)
      const timestampBuf = longToUint8Array(0);
      sender.sendWithRetry(Buffer.concat([timestampBuf], 8));

      const timeUsed = Date.now() - startTime;

      const senderResult = {
        messageCounter,
        timeUsed,
        dataSent: sumSize / 1024,
        throughput: messageCounter / timeUsed * 1000,
        throughputKiB: (sumSize / 1024) / timeUsed * 1000,
      };

      const receiverResult = await receiverResultPromise;

      console.log(getBenchmarkResultString({
        datetime: startTime,
        benchmarkDetails,
        senderResult,
        receiverResult,
      }));

      appendResultToFile({
        filepath: resultFilepath,
        datetime: startTime,
        benchmarkDetails,
        senderResult,
        receiverResult,
      });

      console.log(new Date(), '[SENDER]:', 'Finished benchmarking.');

      // When using libp2p, somehow there is still a connection opened after closing
      // Need to explicitly exit the process
      if (mq === 'libp2p') {
        process.exit(0);
      }

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
      let sumSize = 0;

      const receiver = new Receiver();
      await receiver.setup({
        bindIp: '0.0.0.0',
        bindPort: 20002,
        brokerIp: argv.brokerIp,
        brokerPort: 20001,
        messageHandler: msg => {
          const timestamp = uint8ArrayToLong(msg.slice(0, 8)); // First 8 bytes is timestamp from sender
          
          if (timestamp === 0 && startTime === null) return;

          if (timestamp > 0) {
            sumSize += msg.length;
            latencies.push(Date.now() - timestamp);
          }
          // console.log(msg.from, msg.data.toString())

          if (messageCounter === 0) {
            startTime = timestamp;
            console.log(new Date(), '>>> START BENCHMARKING (First message received)');
          }

          if (timestamp === 0) {
            console.log(new Date(), '>>> FINISH BENCHMARKING (Last message received)');
            const sumLatencies = latencies.reduce((a, b) => a + b, 0);
            const timeUsed = Date.now() - startTime;

            const result = {
              messageCounter,
              timeUsed,
              dataReceived: sumSize / 1024,
              avgLatency: sumLatencies / latencies.length,
              throughput: messageCounter / timeUsed * 1000,
              throughputKiB: (sumSize / 1024) / timeUsed * 1000,
              latencies,
            };
            
            printReceiverResult(result);

            startTime = null;
            sumSize = 0;
            messageCounter = 0;
            latencies = [];

            receiver.sendResult(Buffer.from(JSON.stringify(result)));
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
})();
