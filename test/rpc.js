import test from 'ava';

import Arque from '../src';

test('Should execute job and return result.', async t => {
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
