import amqp from 'amqplib';
import Worker from './worker';
import Client from './client';

const MAX_CONNECTION_LISTENERS = 1000;

export default class Arque {
  constructor () {
    let options;
    if (typeof arguments[0] === 'string') {
      options = {url: arguments[0]};
    } else {
      options = arguments[0] || {};
    }

    this._url = options.url || 'amqp://localhost';
    this._prefix = options.prefix || '';

    this._workers = [];
  }

  async assertConnection () {
    if (!this._assertConnection) {
      this._assertConnection = amqp
        .connect(this._url)
        .then(connection => {
          connection._maxListeners = MAX_CONNECTION_LISTENERS;
          connection.on('error', () => {
            delete this._assertConnection;
            this.startAllWorkers();
          });
          return connection;
        });
    }
    return await this._assertConnection;
  }

  async startAllWorkers () {
    let connection = await this.assertConnection();
    await Promise.all(this._workers.map(worker => worker.start(connection)));
  }

  async createWorker (options, handler) {
    let worker = new Worker(options, handler);
    let connection = await this.assertConnection();
    await worker.start(connection);
    this._workers.push(worker);

    return worker;
  }

  async createClient (options, handler) {
    let connection = await this.assertConnection();
    let client = (function () {
      const client = new Client(options);
      client.setConnection(connection);
      return async function () {
        return await client.exec.apply(client, arguments);
      };
    })();
    return client;
  }
}
