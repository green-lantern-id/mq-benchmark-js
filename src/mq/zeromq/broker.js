'use strict';

const zmq = require('zeromq');

const { sleep } = require('../../utils');

// const testTopic = Buffer.from('test');
// const signalTopic = Buffer.from('signal');

class ZeroMQBroker {
  async setup({ bindIpNetwork1, bindPortNetwork1, bindIpNetwork2, bindPortNetwork2, srcIp, srcPort, destIp, destPort }) {
    this.sockPubNetwork1 = zmq.socket('pub');
    this.sockPubNetwork1.bindSync(`tcp://${bindIpNetwork1}:${bindPortNetwork1}`);

    this.sockSubNetwork1 = zmq.socket('sub');
    this.sockSubNetwork1.connect(`tcp://${srcIp}:${srcPort}`);
    this.sockSubNetwork1.subscribe('');

    this.sockPubNetwork2 = zmq.socket('pub');
    this.sockPubNetwork2.bindSync(`tcp://${bindIpNetwork2}:${bindPortNetwork2}`);

    this.sockSubNetwork2 = zmq.socket('sub');
    this.sockSubNetwork2.connect(`tcp://${destIp}:${destPort}`);
    this.sockSubNetwork2.subscribe('');
    
    this.sockSubNetwork1.on('message', (topic, message) => {
      this.sockPubNetwork2.send([topic, message]);
    });

    this.sockSubNetwork2.on('message', (topic, message) => {
      this.sockPubNetwork1.send([topic, message]);
    });

    await sleep(1000);

    console.log(new Date(), '[BROKER]:', 'Ready!');
  }

  async teardown() {
    this.sockPubNetwork1.close();
    this.sockSubNetwork1.close();
    this.sockPubNetwork2.close();
    this.sockSubNetwork2.close();
  }

}

module.exports = ZeroMQBroker;
