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

arque
  .createClient('echo')
  .exec('Hello World!')
  .then(message => {
    assert.equal(message, 'Hello World!');
  });
```

## Options

### `Arque`
* `url` - RabbitMQ URL
* `prefix` - Queue name prefix

### `Worker`
* `job` - Job name
* `concurrency` - Maximum number of jobs that can be executed concurrently

### `Client`
* `name` - Job name
* `return` - Flag to indicate wether to expect a return value
* `timeout`
