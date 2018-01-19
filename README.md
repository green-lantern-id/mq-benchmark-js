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
    node src/benchmark.js uniform receiver --mq=libp2p -c 10000
    ```

3. Run a broker node

    ```
    node src/benchmark.js <TEST_MODE> broker --mq <MESSAGE_QUEUE_LIB> --receiverIp <RECEIVER_IP>
    ```

    **Example:**

    ```
    node src/benchmark.js uniform broker --mq libp2p --receiverIp 127.0.0.1
    ```

4. Run a sender node

    ```
    node src/benchmark.js <TEST_MODE> sender --mq <MESSAGE_QUEUE_LIB> -s <MESSAGE_SIZE_IN_BYTES> -c <MESSAGE_COUNT> --brokerIp <BROKER_IP>
    ```

    **Example:**

    ```
    node src/benchmark.js uniform sender --mq libp2p -s 1000 -c 10000 --brokerIp 127.0.0.1
    ```

Benchmark result will be printed to the console on receiver node.