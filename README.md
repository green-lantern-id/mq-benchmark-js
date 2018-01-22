# mq-benchmark-js

## Prerequisites

- NodeJS v8.9 or later
- npm

## How to use

1. Install dependencies

    ```
    npm install
    ```

2. Run a receiver node

    ```
    node src/benchmark.js <TEST_MODE> receiver --mq <MESSAGE_QUEUE_LIB> -c <EXPECTED_MESSAGE_COUNT>
    ```

    **Example:**

    ```
    node src/benchmark.js uniform receiver --mq libp2p -c 10000
    node src/benchmark.js poisson receiver --mq libp2p -c 10000 --duration 10
    //command above will end test when receive 10000 messages OR some message timestamp say it send after 10 seconds
    ```

3. Run a broker node

    ```
    node src/benchmark.js <TEST_MODE> broker --mq <MESSAGE_QUEUE_LIB> --receiverIp <RECEIVER_IP>
    ```

    **Example:**

    ```
    node src/benchmark.js uniform broker --mq libp2p --receiverIp 127.0.0.1
    node src/benchmark.js poisson broker --mq libp2p --receiverIp 127.0.0.1
    ```

4. Run a sender node

    ```
    node src/benchmark.js <TEST_MODE> sender --mq <MESSAGE_QUEUE_LIB> -s <MESSAGE_SIZE_IN_BYTES> -c <MESSAGE_COUNT> --brokerIp <BROKER_IP>
    ```

    **Example:**

    ```
    node src/benchmark.js uniform sender --mq libp2p -s 1000 -c 10000 --brokerIp 127.0.0.1
    node src/benchmark.js poisson sender --mq libp2p -c 10000 --duration 10 --avgSize 1000 --avgDelay 1000 --brokerIp 127.0.0.1 //avgDelay is in microsecond, min 1, max 1000
    //command above will stop send when 10000 messages sent OR some 10 seconds after first message sent
    ```

Benchmark result will be printed to the console on receiver node.

## Use with Docker

- Build an image
    
    ```
    docker build -t green-lantern/mq-benchmark-js:0.1 .
    ```

- Receiver

    **Example:**

    ```
    docker run -it --rm \
      -e TEST_MODE='uniform' \
      -e ROLE='receiver' \
      -e MESSAGE_QUEUE='libp2p' \
      -e MESSAGE_COUNT='1000' \
      green-lantern/mq-benchmark-js:0.1
    ```

- Broker
    
    **Example:**

    ```
    docker run -it --rm \
      -e TEST_MODE='uniform' \
      -e ROLE='broker' \
      -e MESSAGE_QUEUE='libp2p' \
      -e RECEIVER_IP='172.17.0.2' \
      green-lantern/mq-benchmark-js:0.1
    ```

- Sender

    **Example:**

    ```
    docker run -it --rm \
      -e TEST_MODE='uniform' \
      -e ROLE='sender' \
      -e MESSAGE_QUEUE='libp2p' \
      -e MESSAGE_COUNT='1000' \
      -e MESSAGE_SIZE='1000' \
      -e BROKER_IP='172.17.0.3' \
      green-lantern/mq-benchmark-js:0.1
    ```
