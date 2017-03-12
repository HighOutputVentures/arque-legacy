# `arque`
A simple microservice framework based on RabbitMQ.

## `Worker`
```js
import Arque from 'arque';

const arque = new Arque();

arque.createWorker('echo', async message => {
  return message;
});
```

## `Client`
```js
import Arque from 'arque';
import assert from 'assert';

const arque = new Arque();

const echo = arque.createClient('echo');

echo('Hello World!')
  .then(message => {
    assert.equal(message, 'Hello World!');
  });
```

### `client.close()`
Gracefully shut down the `arque` client.

## Options

### `Arque`
* `uri` - RabbitMQ URI
* `prefix` - Queue name prefix

### `Worker`
* `job` - Job name
* `concurrency` - Maximum number of jobs that can be executed concurrently

### `Client`
* `job` - Job name
* `timeout`
