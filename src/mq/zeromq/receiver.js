'use strict';

const zmq = require('zeromq');

const { sleep } = require('../../utils');

const testTopic = Buffer.from('test');
const signalTopic = Buffer.from('signal');

class ZeroMQReceiver {
  async setup({ bindIp, bindPort, brokerIp, brokerPort, messageHandler }) {
    this.sockPub = zmq.socket('pub');
    this.sockPub.bindSync(`tcp://${bindIp}:${bindPort}`);

    this.sockSub = zmq.socket('sub');
    this.sockSub.connect(`tcp://${brokerIp}:${brokerPort}`);
    this.sockSub.subscribe('');

    this.sockSub.on('message', (topic, message) => {
      // if (topic.equals(testTopic)) {
        messageHandler(message);
      // } else if (topic.equals(signalTopic)) {

      // }
    });

    await sleep(1000);

    console.log(new Date(), '[RECEIVER]:', 'Ready!');
  }

  async teardown() {
    this.sockPub.close();
    this.sockSub.close();
  }

  // signalFinish() {
  //   this.sockPub.send([signalTopic, Buffer.from('finish')]);
  // }

  sendResult(result) {
    this.sockPub.send([signalTopic, result]);
  }

}

module.exports = ZeroMQReceiver;
