# `arque`
A simple microservice framework based on RabbitMQ.
```js
import Arque from 'arque';

const arque = new Arque();

arque.createWorker('echo', async message => {
  return message;
});

const echo = arque.createClient('echo');

echo('Hello World!')
  .then(message => {
    assert.equal(message, 'Hello World!');
  });
```
## `Arque`
```js
const arque = new Arque();
```
```js
const arque = new Arque('amqp://localhost');
```
```js
const arque = new Arque({
  uri: 'amqp://localhost',
  prefix: null
});
```
### Options
* `uri` - RabbitMQ URI. Default value is `amqp://localhost`.
* `prefix` - Queue name prefix. Default value is `null`.

### `arque.createWorker()`
Creates a worker object.
```js
const worker = arque.createWorker('echo', async message => {
  return message;
});
```
```js
const worker = arque.createWorker({
  job: 'echo',
  concurrency: 1
}, async message => {
  return message;
});
```
#### Options
* `job` - Job name. `Required`
* `concurrency` - Maximum number of jobs that can be executed concurrently. Default value is `1`.

### `arque.createClient()`
Creates a client object.
```js
const client = arque.createClient('echo');
```
```js
const client = arque.createClient({
  job: 'echo',
  timeout: 60000
});
```
#### Options
* `job` - Job name
* `timeout` - Timeout time in milliseconds. Default value is `60000`;
### `arque.close()`
Close RabbitMQ connection.

## `Worker`
### `worker.close()`
Gracefully shut down the `arque` worker.

## `Client`
### `client.close()`
Gracefully shut down the `arque` client.
