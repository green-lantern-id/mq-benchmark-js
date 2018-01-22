'use strict';

const nanoTimer = require('nanotimer');
const nanoTimerObject = new nanoTimer();

const sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
const usleep = (us = 0) => new Promise(resolve => nanoTimerObject.setTimeout(resolve, '', `${us}u`));

const longToUint8Array = (long) => {
  const byteArray = new Uint8Array(8);
  for (let i = 0; i < byteArray.length; i++) {
    let byte = long & 0xff;
    byteArray[i] = byte;
    long = (long - byte) / 256;
  }
  return byteArray;
};

const uint8ArrayToLong = (byteArray) => {
  let value = 0;
  for (let i = byteArray.length - 1; i >= 0; i--) {
    value = (value * 256) + byteArray[i];
  }
  return value;
};

module.exports = {
  sleep,
  usleep,
  longToUint8Array,
  uint8ArrayToLong,
};
