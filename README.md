# mq-benchmark-js

## Prerequisites

- NodeJS v8.9 or later
- npm

## How to use

#### Run a receiver node

```
node benchmark.js <TEST_MODE> --mq=<MESSAGE_QUEUE_LIB> -r=receiver -c <EXPECTED_MESSAGE_COUNT>
```

**Example:**

```
node benchmark.js uniform --mq=libp2p -r=receiver -c 10000
```

#### Run a broker node

```
node benchmark.js <TEST_MODE> --mq=<MESSAGE_QUEUE_LIB> -r=broker
```

**Example:**

```
node benchmark.js uniform --mq=libp2p -r=broker
```

#### Run a sender node

```
node benchmark.js uniform --mq=<MESSAGE_QUEUE_LIB> -r=sender -s <MESSAGE_SIZE_IN_BYTES> -c <MESSAGE_COUNT>
```

**Example:**

```
node benchmark.js uniform --mq=libp2p -r=sender -s 1000 -c 10000
```