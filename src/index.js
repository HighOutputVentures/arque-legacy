import amqp from 'amqplib';
import assert from 'assert';
import Worker from './worker';

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
    if (this._assertConnection) {
      return await this._assertConnection;
    }

    this._assertConnection = amqp
      .connect(this._url)
      .then(connection => {
        connection.on('error', err => {
          console.error(err);
          delete this._assertConnection;
          this.initAllWorkers();
        });

        return connection;
      });
  }

  async initAllWorkers () {
    let connection = await this.assertConnection();
    await Promise.all(this._workers.map(worker => worker.init(connection)));
  }

  async createWorker (options, handler) {
    let job;
    if (typeof options === 'string') {
      job = options;
    } else {
      job = options.job;
    }
    assert(job, 'Job name not specified');

    let worker = new Worker(options, handler);

    let connection = await this.assertConnection();
    await worker.init(connection);
    this._workers.push(worker);

    return worker;
  }
}
