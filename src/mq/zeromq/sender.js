'use strict';

const EventEmitter = require('events');

const zmq = require('zeromq');

const { sleep } = require('../../utils');

const testTopic = Buffer.from('test');
const signalTopic = Buffer.from('signal');

class ZeroMQSender extends EventEmitter {
  async setup({ bindIp, bindPort, brokerIp, brokerPort }) {
    this.sockPub = zmq.socket('pub');
    this.sockPub.bindSync(`tcp://${bindIp}:${bindPort}`);

    this.sockSub = zmq.socket('sub');
    this.sockSub.connect(`tcp://${brokerIp}:${brokerPort}`);
    this.sockSub.subscribe('');

    this.sockSub.on('message', (topic, message) => {
      if (topic.equals(signalTopic)) {
        const dataStr = message.toString();
        const dataJSON = JSON.parse(dataStr);
        
        this.teardown();

        this.emit('result', dataJSON);
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