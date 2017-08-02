const Arque = require('./build').default;

const arque = new Arque('amqp://rabbit:92mvh8VXZCYSH69c@127.0.0.1');

(async () => {
  const worker = await arque.createWorker('test', async message => {
    console.log(message);
  });

  await worker.start();
})();

require('net').createServer().listen();
