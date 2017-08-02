/* @flow */
import test from 'ava';

import Client from '../src/client';
import Arque from '../src/index';
import {randString} from './helpers';
import type {
  ArqueResponse,
  ArqueRequest
} from '../src/types';

const URI = 'amqp://rabbit:92mvh8VXZCYSH69c@127.0.0.1';

test('Should send request correctly', async t => {
  const arque = new Arque({
    uri: URI,
    prefix: randString(8)
  });
  await arque.start();

  const client = new Client(arque, {
    job: 'test'
  });

  const arg = {
    message: randString(24)
  };

  const channel = await arque.connection.createChannel();
  await channel.assertQueue(client.getQueueName(), {
    durable: true
  });
  await channel.consume(client.getQueueName(), async message => {
    await channel.ack(message);

    const correlationId = message.properties.correlationId;
    const request: ArqueRequest = JSON.parse(message.content.toString('utf8'));

    t.is(typeof request.correlationId, 'string');
    t.is(typeof request.timestamp, 'number');
    t.deepEqual(request.arguments, [arg]);

    const response: ArqueResponse = {
      result: request.arguments[0],
      timestamp: Date.now()
    };

    await channel.sendToQueue(
      message.properties.replyTo,
      new Buffer(JSON.stringify(response)),
      {correlationId});
  });

  const result = await client.execute(arg);
  t.deepEqual(result, arg);
});

test('Given workers do not exist', async t => {
  const TIMEOUT = 1500;
  const arque = new Arque({
    uri: URI,
    prefix: randString(8)
  });
  await arque.start();

  const client = new Client(arque, {
    job: 'test',
    timeout: TIMEOUT
  });

  const arg = {
    message: randString(24)
  };

  const timestamp = Date.now();

  const error: Error = await t.throws(client.execute(arg));

  const duration = Date.now() - timestamp;
  t.truthy(duration >= TIMEOUT);
  t.truthy(duration < TIMEOUT + 500);
  // $FlowFixMe
  t.is(error.code, 'ERR_ARQUE_REQUEST_TIMEOUT');
});
