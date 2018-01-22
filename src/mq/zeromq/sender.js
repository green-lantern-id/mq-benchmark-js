'use strict';

const zmq = require('zeromq');

const { sleep } = require('../../utils');

const testTopic = Buffer.from('test');
const signalTopic = Buffer.from('signal');

class ZeroMQSender {
  async setup({ bindIp, bindPort, brokerIp, brokerPort }) {
    this.sockPub = zmq.socket('pub');
    this.sockPub.bindSync(`tcp://${bindIp}:${bindPort}`);

    this.sockSub = zmq.socket('sub');
    this.sockSub.connect(`tcp://${brokerIp}:${brokerPort}`);
    this.sockSub.subscribe('');

    this.sockSub.on('message', (topic, message) => {
      if (topic.equals(signalTopic)) {
        const dataStr = message.toString();
        if (dataStr === 'finish') {
          this.teardown();

          console.log(new Date(), '[SENDER]:', 'Finish benchmarking.');

          // Somehow there is still a opened connection after calling teardown
          // Need to explicitly exit the process
          // process.exit(0);
        }
      }
    });

    await sleep(1000);

    console.log(new Date(), '[SENDER]:', 'Ready!');
  }

  async teardown() {
    this.sockPub.close();
    this.sockSub.close();
  }

  send(message) {
    this.sockPub.send([testTopic, message]);
  }

}

module.exports = ZeroMQSender;