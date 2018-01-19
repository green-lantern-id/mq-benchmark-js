'use strict'

const bluebird = require('bluebird');

const Bundle = require('./bundle');
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
bluebird.Promise.promisifyAll([PeerId, PeerInfo])

const sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

const createNode = async (ip, port) => {
  let node;

  const peerId = await PeerId.createFromJSONAsync(require('./id-2'));
  const peerInfo = await PeerInfo.createAsync(peerId);
  peerInfo.multiaddrs.add(`/ip4/${ip}/tcp/${port}`);
  // console.log('PeerInfo:', JSON.stringify(peerInfo, null, 2));
  node = new Bundle(peerInfo);
  await node.startAsync();
  return node;
};

module.exports = {
  createNode,
  sleep,
};