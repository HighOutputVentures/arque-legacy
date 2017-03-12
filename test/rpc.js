import test from 'ava';
import _ from 'lodash';
import {generate as randString} from 'rand-token';

import Arque from '../src';
import {delay} from './helpers';

const arque = new Arque();

test.after(async () => {
  await arque.close();
});

test('Should close arque.', async t => {
  const arque = new Arque();
  await arque.assertConnection();
  await arque.close();
});

test('Should execute job and return result.', async t => {
  const DELAY = 250;
  const JOB_NAME = 'echo' + randString(8);
  const MESSAGE = 'Hello World!';
  await arque.createWorker(JOB_NAME, async message => {
    await delay(DELAY);
    return message;
  });
  const echo = await arque.createClient(JOB_NAME);
  let result = await echo(MESSAGE);
  t.is(result, MESSAGE, `Returned value should be equal to '${MESSAGE}'`);
});

test('Should execute jobs sequentially', async t => {
  const DELAY = 250;
  const JOB_NAME = 'echo' + randString(8);
  await arque.createWorker(JOB_NAME, async message => {
    await delay(DELAY);
    return message;
  });
  const echo = await arque.createClient(JOB_NAME);
  const timestamp = Date.now();
  const result = await Promise.all(_.times(3, async index => {
    return await echo({index});
  }));
  t.truthy(Date.now() - timestamp >= DELAY * 3);
  t.truthy(Date.now() - timestamp < (DELAY * 3) + 250);
  t.deepEqual(result, _.times(3, index => {
    return {index};
  }));
});

test('Should execute jobs in parallel', async t => {
  const DELAY = 250;
  const JOB_NAME = 'echo' + randString(8);
  await arque.createWorker({
    job: JOB_NAME,
    concurrency: 10
  }, async message => {
    await delay(DELAY);
    return message;
  });
  const echo = await arque.createClient(JOB_NAME);
  const timestamp = Date.now();
  const result = await Promise.all(_.times(10, async index => {
    return await echo({index});
  }));
  t.truthy(Date.now() - timestamp >= DELAY);
  t.truthy(Date.now() - timestamp < DELAY + 250);
  t.deepEqual(result, _.times(10, index => {
    return {index};
  }));
});

test('Should distribute jobs to multiple workers', async t => {
  const DELAY = 250;
  const JOB_NAME = 'echo' + randString(8);
  const counts = [];
  await Promise.all(_.times(5, async index => {
    await arque.createWorker({
      job: JOB_NAME,
      concurrency: 4
    }, async message => {
      counts[index] = (counts[index] || 0) + 1;
      await delay(DELAY);
      return message;
    });
  }));
  const echo = await arque.createClient(JOB_NAME);
  const timestamp = Date.now();
  const result = await Promise.all(_.times(20, async index => {
    return await echo({index});
  }));
  t.truthy(Date.now() - timestamp >= DELAY);
  t.truthy(Date.now() - timestamp < DELAY + 250);
  t.deepEqual(result, _.times(20, index => {
    return {index};
  }));
  t.deepEqual(counts, [4, 4, 4, 4, 4]);
});

test('Should close client', async t => {
  const JOB_NAME = 'echo' + randString(8);
  const echo = await arque.createClient(JOB_NAME);
  await echo.close();
});

test('Should close client gracefully.', async t => {
  const DELAY = 250;
  const JOB_NAME = 'echo' + randString(8);
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
  t.truthy(Date.now() - timestamp < DELAY + 250);
  t.deepEqual(await promise, _.times(5, index => {
    return {index};
  }));
});

test('Should close worker', async t => {
  const JOB_NAME = 'echo' + randString(8);
  const worker = await arque.createWorker(JOB_NAME, async message => {
    return message;
  });
  await worker.close();
});

test('Should close worker gracefully.', async t => {
  const DELAY = 250;
  const JOB_NAME = 'echo' + randString(8);
  let count = 0;
  let receiveCallback;
  const worker = await arque.createWorker({
    concurrency: 5,
    job: JOB_NAME
  }, async message => {
    count++;
    if (count >= 5) {
      receiveCallback();
    }
    await delay(DELAY);
    return message;
  });
  const echo = await arque.createClient(JOB_NAME);
  const promise = Promise.all(_.times(5, async index => {
    return await echo({index});
  }));

  await new Promise(resolve => {
    receiveCallback = resolve;
  });
  const timestamp = Date.now();
  await worker.close();
  t.truthy(Date.now() - timestamp >= DELAY);
  t.truthy(Date.now() - timestamp < DELAY + 250);
  t.deepEqual(await promise, _.times(5, index => {
    return {index};
  }));
});

test('Should handle error correctly', async t => {
  const JOB_NAME = 'echo' + randString(8);
  await arque.createWorker(JOB_NAME, async () => {
    const error = new Error('Error');
    error.code = 'ERROR';
    throw error;
  });
  const echo = await arque.createClient(JOB_NAME);
  let error = await t.throws(echo());
  t.is(error.message, 'Error');
  t.is(error.code, 'ERROR');
});

test('Should handle timeout correctly', async t => {
  const DELAY = 1000;
  const JOB_NAME = 'echo' + randString(8);
  await arque.createWorker(JOB_NAME, async () => {
    await delay(DELAY);
  });
  const echo = await arque.createClient({
    job: JOB_NAME,
    timeout: 500
  });
  let error = await t.throws(echo());
  t.is(error.code, 'TIMEOUT');
});
