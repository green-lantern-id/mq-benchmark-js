'use strict';

process.on('unhandledRejection', function(reason, p) {
  // console.error('Unhandled Rejection:', p, '\nreason:', reason.stack || reason);
  console.error(reason.stack);
});

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const yargs = require('yargs');

const { longToUint8Array, uint8ArrayToLong, sleep, usleep } = require('./utils');

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
            describe: 'Duration of sender sending messages in seconds',
            type: 'number',
            // demandOption: true,
          })
          .option('bindPort', {
            describe: 'Port to bind',
            type: 'number',
          })
          .option('destIp', {
            describe: 'destination node IP address',
            type: 'string',
            demandOption: true,
          })
          .option('destPort', {
            describe: 'destination node port',
            type: 'number',
          });
      })
      .command('broker', 'broker role', yargs => {
        yargs.option('bindPortNetwork1', {
          describe: 'Port to bind on network 1',
          type: 'number',
        })
        .option('bindPortNetwork2', {
          describe: 'Port to bind on network 1',
          type: 'number',
        })
        .option('destIp', {
          describe: 'destination node IP address',
          type: 'string',
          demandOption: true,
        })
        .option('destPort', {
          describe: 'destination node port',
          type: 'number',
        })
        .option('srcIp', {
          describe: 'source node IP address',
          type: 'string',
        })
        .option('srcPort', {
          describe: 'source node port',
          type: 'number',
        });
      })
      .command('receiver', 'receiver role', yargs => {
        yargs.option('duration', {
          alias: 'd',
          describe: 'Duration until receiver stops receiving messages and end the benchmark in seconds.',
          type: 'number',
          // demandOption: true,
        })
        .option('bindPort', {
          describe: 'Port to bind',
          type: 'number',
        })
        .option('srcIp', {
          describe: 'source node IP address',
          type: 'string',
        })
        .option('srcPort', {
          describe: 'source node port',
          type: 'number',
        });
      })
      .demandCommand(1, 'You need to specifiy a role to test');
  })
  .command('poisson', 'start a test in Poisson mode', yargs => {
    yargs
      .command('sender', 'sender role', yargs => {
        yargs
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
          .option('delayInMillisecond', {
            //alias: 'ms',
            describe:
              'Flag to tell poisson to read avgDelay as millisecond',
            type: 'boolean'
          })
          .option('bindPort', {
            describe: 'Port to bind',
            type: 'number',
          })
          .option('destIp', {
            describe: 'destination node IP address',
            type: 'string',
            demandOption: true,
          })
          .option('destPort', {
            describe: 'destination node port',
            type: 'number',
          })
          .check(function(argv) {
            if(argv.avgDelay && (argv.avgDelay > 1000 || argv.avgDelay < 1)) return false;
            if(!argv.messageSize && !argv.avgSize) return false;
            if(argv.avgSize && (argv.avgSize < 1024 || argv.avgSize > 1048576)) return false;
            return true;
          }, false);
      })
      .command('broker', 'broker role', yargs => {
        yargs.option('bindPortNetwork1', {
          describe: 'Port to bind on network 1',
          type: 'number',
        })
        .option('bindPortNetwork2', {
          describe: 'Port to bind on network 1',
          type: 'number',
        })
        .option('destIp', {
          describe: 'destination node IP address',
          type: 'string',
          demandOption: true,
        })
        .option('destPort', {
          describe: 'destination node port',
          type: 'number',
        })
        .option('srcIp', {
          describe: 'source node IP address',
          type: 'string',
        })
        .option('srcPort', {
          describe: 'source node port',
          type: 'string',
        });
      })
      .command('receiver', 'receiver role', yargs => {
        yargs.option('duration', {
          alias: 'd',
          describe: 'Duration until receiver stops receiving messages and end the benchmark in seconds.',
          type: 'number',
        })
        .option('bindPort', {
          describe: 'Port to bind',
          type: 'number',
        })
        .option('srcIp', {
          describe: 'source node IP address',
          type: 'string',
        })
        .option('srcPort', {
          describe: 'source node port',
          type: 'number',
        });
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
    // default: './mq_result.txt',
  })
  .option('name', {
    alias: 'n',
    describe: 'benchmark name',
    type: 'string',
    default: '',
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
const delayInMillisecond = argv.delayInMillisecond;
const resultFilepath = argv.resultFilepath
  ? argv.resultFilepath
  : role === 'sender' ? './mq_sender_result.txt' : './mq_receiver_result.txt';
const name = argv.name;

const benchmarkDetails = {
  name,
  mq,
  distribution: mode,
  messageCount,
  messageSize,
  duration,
  delay,
  avgSize,
  avgDelay,
};

const printSenderResult = (result, benchmarkDetails) => {
  console.log(getSenderResultString({
    result,
    benchmarkDetails,
  }));
};

const getSenderResultString = ({ result, benchmarkDetails }) => {
  return `===== MQ BENCHMARK RESULT =====
Name: ${benchmarkDetails.name}

${getBenchmarkDetailsString({ benchmarkDetails })}
***** SENDER *****
Message sent: ${result.messageCounter}
Time used: ${result.timeUsed} ms
Data sent: ${result.dataSent} KiB
Throughput: ${result.throughput} msg/sec
Throughput: ${result.throughputKiB} KiB/sec

========================
`;
};

const printReceiverResult = (result, withLatencies) => {
  console.log(
    getReceiverResultString({
      result,
      withLatencies,
      benchmarkDetails,
    })
  );
};

const getReceiverResultString = ({ result, withLatencies, benchmarkDetails }) => {
  let latenciesStr = '';
  if (withLatencies) {
    latenciesStr = `\nLatencies (ms):\n${result.latencies}\n`;
  }

  return `===== MQ BENCHMARK RESULT =====
Name: ${benchmarkDetails.name}

${getBenchmarkDetailsString({ benchmarkDetails })}
***** RECEIVER *****
Message received: ${result.messageCounter}
Time used: ${result.timeUsed} ms
Data received: ${result.dataReceived} KiB
Avg latency: ${result.avgLatency} ms
Throughput: ${result.throughput} msg/sec
Throughput: ${result.throughputKiB} KiB/sec
Receive Timed out: ${result.timeout} ${result.timeout ? `(${result.timeoutDuration} seconds)` : ''}
${latenciesStr}
========================
`;
};

const getBenchmarkDetailsString = ({ benchmarkDetails }) => {
  let otherBenchmarkDetailsStr = '';
  if (typeof benchmarkDetails.messageCount === 'number') otherBenchmarkDetailsStr += `Message count: ${benchmarkDetails.messageCount}\n`;
  if (typeof benchmarkDetails.messageSize === 'number') otherBenchmarkDetailsStr += `Message size: ${benchmarkDetails.messageSize} bytes\n`;
  if (typeof benchmarkDetails.duration === 'number') otherBenchmarkDetailsStr += `Duration: ${benchmarkDetails.duration} seconds\n`;
  if (typeof benchmarkDetails.delay === 'number') otherBenchmarkDetailsStr += `Delay between sending messages: ${benchmarkDetails.delay} microseconds\n`;
  if (typeof benchmarkDetails.avgSize === 'number') otherBenchmarkDetailsStr += `Average message size: ${benchmarkDetails.avgSize} bytes\n`;
  if (typeof benchmarkDetails.avgDelay === 'number') otherBenchmarkDetailsStr += `Average delay between sending messages: ${benchmarkDetails.avgDelay} microseconds\n`;

  return `MQ: ${benchmarkDetails.mq}
Distribution: ${benchmarkDetails.distribution}
${otherBenchmarkDetailsStr}`;
};

const getBenchmarkResultString = ({ datetime, benchmarkDetails, senderResult, receiverResult, withLatencies }) => {
  const datetimeStr = (new Date(datetime)).toString();
  
  let latenciesStr = '';
  if (withLatencies) {
    latenciesStr = `\nLatencies (ms):\n${receiverResult.latencies}\n`;
  }

  const messageLossCount = senderResult.messageCounter - receiverResult.messageCounter;
  const messageLossPercent = messageLossCount / senderResult.messageCounter * 100;

  const benchmarkResultStr = `===== MQ BENCHMARK RESULT =====
Name: ${benchmarkDetails.name}
${datetimeStr}

${getBenchmarkDetailsString({ benchmarkDetails })}
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
Receive Timed out: ${receiverResult.timeout} ${receiverResult.timeout ? `(${receiverResult.timeoutDuration} seconds)` : ''}
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

const appendSenderResultToFile = ({ filepath, datetime, benchmarkDetails, result }) => {
  const stringToWrite = getSenderResultString({
    datetime,
    benchmarkDetails,
    result,
  });

  try {
    fs.appendFileSync(path.resolve(__dirname, filepath), `${stringToWrite}\n`);
  } catch (err) {
    console.error('Error appending sender result to file', err);
  }
};

const appendReceiverResultToFile = ({ filepath, datetime, benchmarkDetails, result }) => {
  const stringToWrite = getReceiverResultString({
    datetime,
    benchmarkDetails,
    result,
    withLatencies: true,
  });

  try {
    fs.appendFileSync(path.resolve(__dirname, filepath), `${stringToWrite}\n`);
  } catch (err) {
    console.error('Error appending receiver result to file', err);
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
      const bindIp = '0.0.0.0';
      const bindPort =  argv.bindPort || 10001;
      const destIp = argv.destIp;
      const destPort = argv.destPort || 10002;

      console.log(`Starting SENDER with parameters:
Bind IP: ${bindIp}
Bind Port: ${bindPort}
Destination IP: ${destIp}
Destination Port: ${destPort}
`);

      const sender = new Sender();
      await sender.setup({
        bindIp,
        bindPort,
        destIp,
        destPort,
      });

      const receiverResultPromise = new Promise(r => sender.once('result', (result) => r(result)));

      let messageCounter = 0;
      let sumSize = 0;
      const startTime = Date.now();

      if (mode === 'uniform') { // Uniform

        const message = crypto.randomBytes(messageSize);
        const messageLength = 8 + message.length;
        
        if (typeof messageCount === 'number') {
          for (let i = 0; i < messageCount; i++) {
            const timestampBuf = longToUint8Array(Date.now());
            sender.send(Buffer.concat([timestampBuf, message], messageLength));
            messageCounter++;
            sumSize += messageLength;
            if (delay !== 0) {
              await usleep(delay);
            }
          }
        } else if (typeof duration === 'number') {
          const durationInMilliseconds = duration * 1000;
          while (Date.now() - startTime < durationInMilliseconds) {
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

        if (!(typeof avgSize === 'number') && !(typeof avgDelay === 'number'))
          console.log('\n===\nNo avgSize or avgDelay specified, will behave like uniform.\n===\n');

        const message = crypto.randomBytes(typeof avgSize === 'number' ? avgSize * 2 : messageSize);
        var randomSize, randomDelay;
        if (typeof avgSize === 'number') randomSize = new PoissonObject(avgSize / 1024);
        if (typeof avgDelay === 'number') randomDelay = new PoissonObject(avgDelay);
        let timestampBuf,
          messageLength,
          payloadLength,
          counter = typeof messageCount === 'number' ? messageCount : undefined;

        while (true) {
          payloadLength = typeof avgSize === 'number' ? randomSize.sample() * 1024 : messageSize;
          messageLength = 8 + payloadLength;
          timestampBuf = longToUint8Array(Date.now());

          if (typeof avgDelay === 'number') {
            //let sleepTime = randomDelay.sample();
            //let before = process.hrtime();
            if(delayInMillisecond) await sleep(randomDelay.sample());
            else await usleep(randomDelay.sample());
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
          if (typeof duration === 'number' && duration * 1000 <= Date.now() - startTime) {
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

      printSenderResult(senderResult, benchmarkDetails);

      appendSenderResultToFile({
        filepath: resultFilepath,
        datetime: startTime,
        benchmarkDetails,
        result: senderResult,
      });

      const receiverResult = await receiverResultPromise;

      console.log(getBenchmarkResultString({
        datetime: startTime,
        benchmarkDetails,
        senderResult,
        receiverResult,
      }));

      // appendResultToFile({
      //   filepath: resultFilepath,
      //   datetime: startTime,
      //   benchmarkDetails,
      //   senderResult,
      //   receiverResult,
      // });

      await sender.teardown();

      console.log(new Date(), '[SENDER]:', 'Finished benchmarking.');

      // When using libp2p, somehow there is still a connection opened after closing
      // Need to explicitly exit the process
      // if (mq === 'libp2p') {
      //   process.exit(0);
      // }

      break;
    }
    case 'broker': {
      const bindIpNetwork1 = '0.0.0.0';
      const bindPortNetwork1 = argv.bindPortNetwork1 || 10002;
      const bindIpNetwork2 = '0.0.0.0';
      const bindPortNetwork2 = argv.bindPortNetwork2 || 20001;
      const srcIp = argv.srcIp;
      const srcPort = argv.srcPort || 10001;
      const destIp = argv.destIp;
      const destPort = argv.destPort || 20002;

      console.log(`Starting BROKER with parameters:
Bind IP (Network 1): ${bindIpNetwork1}
Bind Port (Network 1): ${bindPortNetwork1}
Bind IP (Network 2): ${bindIpNetwork2}
Bind Port (Network 2): ${bindPortNetwork2}
Source IP (Network 1): ${srcIp}
Source Port (Network 1): ${srcPort}
Destination IP (Network 2): ${destIp}
Destination Port (Network 2): ${destPort}
`);

      const broker = new Broker();
      await broker.setup({
        bindIpNetwork1,
        bindPortNetwork1,
        bindIpNetwork2,
        bindPortNetwork2,
        srcIp,
        srcPort,
        destIp,
        destPort,
      });

      console.log('\n*****\nPlease restart the process before starting a new benchmark.\n*****\n');

      break;
    }
    case 'receiver': {
      const bindIp = '0.0.0.0';
      const bindPort = argv.bindPort || 10002;
      const srcIp = argv.srcIp;
      const srcPort = argv.srcPort || 10001;

      console.log(`Starting RECEIVER with parameters:
Bind IP: ${bindIp}
Bind Port: ${bindPort}
Source IP: ${srcIp}
Source Port: ${srcPort}
`);

      let startTime = null;
      let messageCounter = 0;
      let latencies = [];
      let sumSize = 0;
      let receiveTimeout = false;
      let receiveTimeoutFn = null;

      const receiver = new Receiver();
      await receiver.setup({
        bindIp,
        bindPort,
        srcIp,
        srcPort,
        messageHandler: async (msg) => {
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

            if (typeof duration === 'number') {
              receiveTimeoutFn = setTimeout(() => {
                receiveTimeout = true;
                receiver.stopReceiving();
              }, duration * 1000);
            }
          }

          if (timestamp === 0) {
            receiver.stopReceiving();
            return;
          }

          messageCounter++;
        },
      });

      await new Promise(r => receiver.once('stopped', (result) => r(result)));

      console.log(new Date(), `>>> FINISH BENCHMARKING (${receiveTimeout ? `Receive timed out => ${duration} seconds` : 'Last message received'})`);
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
        timeout: receiveTimeout,
        timeoutDuration: duration,
      };
      
      printReceiverResult(result, false);

      appendReceiverResultToFile({
        filepath: resultFilepath,
        datetime: startTime,
        benchmarkDetails,
        result,
      });

      receiver.sendResult(Buffer.from(JSON.stringify(result)));

      startTime = null;
      sumSize = 0;
      messageCounter = 0;
      latencies = [];
      receiveTimeout = false;
      clearTimeout(receiveTimeoutFn);
      receiveTimeoutFn = null;

      console.log('*****\nPlease restart the process before starting a new benchmark.\n*****\n');

      break;
    }
    default:
      console.log('Invalid role');
  }
})();
