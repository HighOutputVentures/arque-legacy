import test from 'ava';
import _ from 'lodash';
import {generate as randString} from 'rand-token';

import Arque from '../src';
import {delay} from './helpers';

test.test('Should execute job and return result.', async t => {
  const JOB_NAME = 'echo';
  const MESSAGE = 'Hello World!';
  const arque = new Arque();
  await arque.createWorker(JOB_NAME, async message => {
    return message;
  });
  const echo = await arque.createClient(JOB_NAME);
  let result = await echo(MESSAGE);
  t.is(result, MESSAGE, `Returned value should be equal to '${MESSAGE}'`);
});

test('Should close client gracefully.', async t => {
  const DELAY = 250;
  const JOB_NAME = 'echo' + randString(8);
  const arque = new Arque();
  await arque.createWorker({
    concurrency: 5,
    job: JOB_NAME
  }, async message => {
    await delay(DELAY);
    return message;
  });
  const echo = await arque.createClient(JOB_NAME);
  const promise = Promise.all(_.times(5, async index => {
    return await echo({index});
  }));
  const timestamp = Date.now();
  await echo.close();
  t.truthy(Date.now() - timestamp >= DELAY);
  t.truthy(Date.now() - timestamp < DELAY + 150);
  t.deepEqual(await promise, _.times(5, index => {
    return {index};
  }));
});
