/* @flow */
import test from 'ava';
import uuid from 'uuid';

import Worker from '../src/worker';
import Arque from '../src/index';
import {randString} from './helpers';
import {delay} from '../src/helpers';

const URI = process.env.RABBITMQ_URI || 'amqp://127.0.0.1';

test('Should handle request correctly', async t => {
  const arque = new Arque({
    uri: URI,
    prefix: randString(8)
  });
  await arque.start();

  const worker = new Worker(arque, {
    job: 'test'
  }, async (message) => {
    await delay(Math.random() * 1000 + 500);
    return message;
  });
  await worker.start();

  const payload = {
    message: randString(8)
  };

  const channel = await arque.connection.createChannel();
  const correlationId = uuid.v4().replace(/-/g, '');
  const replyTo = 'callback.' + uuid.v4().replace(/-/g, '');
  await channel.assertQueue(replyTo, {
    durable: true
  });
  const resultPromise = new Promise((resolve) => {
    channel.consume(replyTo, async message => {
      await channel.ack(message);

      const payload = JSON.parse(message.content.toString());
      resolve(payload.result);
    });
  });
  await channel.sendToQueue(
    worker.getQueueName(),
    new Buffer(JSON.stringify({
      correlationId,
      arguments: [payload],
      timestamp: Date.now()
    })),
    {correlationId, replyTo});

  t.deepEqual(await resultPromise, payload);
});
