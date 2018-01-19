FROM node:8.9.4-alpine

RUN mkdir -p /mq-benchmark-js
COPY . /mq-benchmark-js

WORKDIR /mq-benchmark-js

RUN apk add --update \
    bash \
    make \
    g++ \
    git \
    python

RUN npm install

CMD node /mq-benchmark-js/src/benchmark.js $TEST_MODE $ROLE --mq $MESSAGE_QUEUE -c $MESSAGE_COUNT -s $MESSAGE_SIZE --brokerIp $BROKER_IP --receiverIp $RECEIVER_IP -d $DURATION