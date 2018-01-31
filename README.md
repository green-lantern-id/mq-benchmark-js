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
    node src/benchmark.js <TEST_MODE> receiver \
         --mq <MESSAGE_QUEUE_LIB> \
         -d <RECEIVE_TIMEOUT_DURATION> \
         -n <NAME> \
         --bindPort <BIND_PORT> \
         --srcIp <SRC_IP> \
         --srcPort <SRC_PORT> \
         --resultFilepath <RESULT_FILEPATH>
    ```

    **Options:**

    - `bindPort`: (Default `10002`)
    - `srcIp`: Required only when using ZeroMQ
    - `srcPort`: (Default `10001`)

    **Example:**

    libp2p

    ```
    node src/benchmark.js uniform receiver --mq libp2p
    ```

    ```
    node src/benchmark.js uniform receiver --mq libp2p -d 3000
    ```

    ZeroMQ

    ```
    node src/benchmark.js uniform receiver --mq zeromq --srcIp 127.0.0.1
    ```

3. Run a broker node (Optional)

    ```
    node src/benchmark.js <TEST_MODE> broker \
         --mq <MESSAGE_QUEUE_LIB> \
         --bindPortNetwork1 <BIND_PORT_NETWORK_1> \
         --bindPortNetwork2 <BIND_PORT_NETWORK_2> \
         --srcIp <SRC_IP> \
         --srcPort <SRC_PORT>
         --destIp <DEST_IP> \
         --destPort <DEST_PORT>
    ```

    **Options:**

    - `bindPortNetwork1`: (Default `10002`)
    - `bindPortNetwork2`: (Default `20001`)
    - `srcIp`: Required only when using ZeroMQ
    - `srcPort`: (Default `10001`)
    - `destIp`: Required
    - `destPort`: (Default `20002`)

    **Example:**

    libp2p

    ```
    node src/benchmark.js uniform broker --mq libp2p --destIp 127.0.0.1
    ```

    ```
    node src/benchmark.js poisson broker --mq libp2p --destIp 127.0.0.1
    ```

    ZeroMQ

    ```
    node src/benchmark.js uniform broker --mq zeromq --srcIp 127.0.0.1 --destIp 127.0.0.1
    ```

4. Run a sender node

    Parameters:
      `resultFilepath`: Default is `./mq_sender_result.txt` for sender and `./mq_receiver_result.txt` for receiver

    #### Uniform

    ```
    node src/benchmark.js <TEST_MODE> sender \
         --mq <MESSAGE_QUEUE_LIB> \
         -s <MESSAGE_SIZE_IN_BYTES> \
         -c <MESSAGE_COUNT> \
         -d <DURATION_IN_SECONDS> \
         --delay <DELAY_IN_MICROSECONDS> \
         --bindPort <BIND_PORT> \
         --destIp <DEST_IP> \
         --destPort <DEST_PORT> \
         -n <NAME> \
         --resultFilepath <RESULT_FILEPATH>
    ```

    **Options:**

    - `delay`: Delay between message transmissions in microseconds

    - `bindPort`: (Default `10001`)
    - `destIp`: Required
    - `destPort`: (Default `10002`)

    **Example:**

    libp2p

    ```
    node src/benchmark.js uniform sender --mq libp2p -s 1000 -c 10000 --destIp 127.0.0.1
    ```

    ```
    node src/benchmark.js uniform sender --mq libp2p -s 1000 -d 3 --destIp 127.0.0.1
    ```

    ```
    node src/benchmark.js uniform sender --mq libp2p -s 1000 -d 2 --delay 100 --destIp 127.0.0.1
    ```

    ZeroMQ

    ```
    node src/benchmark.js uniform sender --mq zeromq -s 1000 -c 10000 --delay 100 --destIp 127.0.0.1
    ```

    #### Poisson

     ```
    node src/benchmark.js <TEST_MODE> sender \
         --mq <MESSAGE_QUEUE_LIB> \
         -c <MESSAGE_COUNT> \
         -d <DURATION_IN_SECONDS> \
         --avgSize <AVERAGE_MESSAGE_SIZE_IN_BYTES> \
         --avgDelay <AVERAGE_DELAY_IN_MICROSECONDS> \
         --bindPort <BIND_PORT> \
         --destIp <DEST_IP> \
         --destPort <DEST_PORT> \
         -n <NAME> \
         --resultFilepath <RESULT_FILEPATH>
    ```

    **Options:**

    - `avgSize`: Average message size in bytes (min: 1024)
    - `avgDelay`: Average delay between sending messages in microseconds, (min: 1, max: 1000)

    **Example:**

    The command below: stop send when 10000 messages sent OR some 10 seconds after first message sent

    ```
    node src/benchmark.js poisson sender --mq libp2p -c 10000 -d 10 --avgSize 1024 --avgDelay 1000 --destIp 127.0.0.1
    ```

Benchmark result will be printed to the console and written to files on sender and receiver nodes.

## Use with Docker

- Build an image
    
    ```
    docker build -t green-lantern/mq-benchmark-js:0.1 .
    ```

- Receiver

    **Example:**

    libp2p

    ```
    docker run -it --rm \
      -v "$PWD"/logs:/var/log \
      -e TEST_MODE='uniform' \
      -e ROLE='receiver' \
      -e MESSAGE_QUEUE='libp2p' \
      -e NAME='Benchmark 1' \
      -e RESULT_FILEPATH='/var/log/mq_receiver_result.txt' \
      green-lantern/mq-benchmark-js:0.1
    ```

    ```
    docker run -it --rm \
      -v "$PWD"/logs:/var/log \
      -e TEST_MODE='uniform' \
      -e ROLE='receiver' \
      -e MESSAGE_QUEUE='libp2p' \
      -e DURATION='300' \
      -e NAME='Benchmark 1' \
      -e RESULT_FILEPATH='/var/log/mq_receiver_result.txt' \
      green-lantern/mq-benchmark-js:0.1
    ```

    ZeroMQ

    ```
    docker run -it --rm \
      -v "$PWD"/logs:/var/log \
      -e TEST_MODE='uniform' \
      -e ROLE='receiver' \
      -e MESSAGE_QUEUE='zeromq' \
      -e SRC_IP='172.17.0.3' \
      -e NAME='Benchmark 1' \
      -e RESULT_FILEPATH='/var/log/mq_receiver_result.txt' \
      green-lantern/mq-benchmark-js:0.1
    ```

- Broker
    
    **Example:**

    libp2p

    ```
    docker run -it --rm \
      -e TEST_MODE='uniform' \
      -e ROLE='broker' \
      -e MESSAGE_QUEUE='libp2p' \
      -e DEST_IP='172.17.0.2' \
      green-lantern/mq-benchmark-js:0.1
    ```

    ZeroMQ

    ```
    docker run -it --rm \
      -e TEST_MODE='uniform' \
      -e ROLE='broker' \
      -e MESSAGE_QUEUE='zeromq' \
      -e SRC_IP='172.17.0.4' \
      -e DEST_IP='172.17.0.2' \
      green-lantern/mq-benchmark-js:0.1
    ```

- Sender

    **Example (Uniform):**

    libp2p

    ```
    docker run -it --rm \
      -v "$PWD"/logs:/var/log \
      -e TEST_MODE='uniform' \
      -e ROLE='sender' \
      -e MESSAGE_QUEUE='libp2p' \
      -e MESSAGE_COUNT='1000' \
      -e MESSAGE_SIZE='1000' \
      -e DEST_IP='172.17.0.3' \
      -e NAME='Benchmark 1' \
      -e RESULT_FILEPATH='/var/log/mq_sender_result.txt' \
      green-lantern/mq-benchmark-js:0.1
    ```

     ```
    docker run -it --rm \
      -v "$PWD"/logs:/var/log \
      -e TEST_MODE='uniform' \
      -e ROLE='sender' \
      -e MESSAGE_QUEUE='libp2p' \
      -e DURATION='3' \
      -e MESSAGE_SIZE='1000' \
      -e DEST_IP='172.17.0.3' \
      -e NAME='Benchmark 2' \
      -e RESULT_FILEPATH='/var/log/mq_sender_result.txt' \
      green-lantern/mq-benchmark-js:0.1
    ```

    ```
    docker run -it --rm \
      -v "$PWD"/logs:/var/log \
      -e TEST_MODE='uniform' \
      -e ROLE='sender' \
      -e MESSAGE_QUEUE='libp2p' \
      -e DURATION='2' \
      -e DELAY='100' \
      -e MESSAGE_SIZE='1000' \
      -e DEST_IP='172.17.0.3' \
      -e NAME='Benchmark 3' \
      -e RESULT_FILEPATH='/var/log/mq_sender_result.txt' \
      green-lantern/mq-benchmark-js:0.1
    ```

    ZeroMQ

    ```
    docker run -it --rm \
      -v "$PWD"/logs:/var/log \
      -e TEST_MODE='uniform' \
      -e ROLE='sender' \
      -e MESSAGE_QUEUE='zeromq' \
      -e MESSAGE_COUNT='1000' \
      -e MESSAGE_SIZE='1000' \
      -e DEST_IP='172.17.0.3' \
      -e NAME='Benchmark 1' \
      -e RESULT_FILEPATH='/var/log/mq_sender_result.txt' \
      green-lantern/mq-benchmark-js:0.1
    ```

    **Example (Poisson):**

    ```
    docker run -it --rm \
      -v "$PWD"/logs:/var/log \
      -e TEST_MODE='poisson' \
      -e ROLE='sender' \
      -e MESSAGE_QUEUE='libp2p' \
      -e MESSAGE_COUNT='10000' \
      -e DURATION='10' \
      -e AVG_DELAY='1000' \
      -e AVG_SIZE='1024' \
      -e DEST_IP='172.17.0.3' \
      -e NAME='Benchmark 4' \
      -e RESULT_FILEPATH='/var/log/mq_sender_result.txt' \
      green-lantern/mq-benchmark-js:0.1
    ```

Note: See `Dockerfile` for all available options