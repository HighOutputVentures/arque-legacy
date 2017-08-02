/* @flow */
import amqp from 'amqplib';

import type {
  AMQPConnection,
  IArque
} from './types';
// import Worker from './worker';
// import Client from './client';

export default class Arque implements IArque {
  options: {uri: string, prefix: string}
  assertConnectionPromise: Promise<AMQPConnection>
  closePromise: Promise<void>
  connection: AMQPConnection
  constructor (options: string | {uri: string, prefix?: string}) {
    if (typeof options === 'string') {
      this.options = {uri: options, prefix: ''};
    } else {
      this.options = {
        uri: options.uri,
        prefix: options.prefix || ''
      };
    }
  }

  async assertConnection () {
    if (!this.assertConnectionPromise) {
      const assertConnection = async () => {
        const connection = await amqp.connect(this.options.uri);

        connection.on('error', () => {
          delete this.assertConnectionPromise;
        });
        connection.on('close', () => {
          delete this.assertConnectionPromise;
        });
        this.connection = connection;
        return connection;
      };
      this.assertConnectionPromise = assertConnection();
    }

    return this.assertConnectionPromise;
  }

  // async createClient (options, handler) {
  //   if (typeof options === 'string') {
  //     options = {job: options};
  //   }
  //   options.prefix = this._prefix;
  //   options.prefix = this._prefix;
  //   let connection = await this.assertConnection();
  //   let client = (function () {
  //     const client = new Client(options);
  //     client.setConnection(connection);

  //     const clientFunc = async function () {
  //       return await client.exec.apply(client, arguments);
  //     };

  //     clientFunc.close = async function () {
  //       await client.close.apply(client);
  //     };
  //     return clientFunc;
  //   })();
  //   return client;
  // }

  // async createWorker (options, handler) {
  //   if (typeof options === 'string') {
  //     options = {job: options};
  //   }
  //   options.prefix = this._prefix;
  //   let worker = new Worker(options, handler);
  //   let connection = await this.assertConnection();
  //   await worker.start(connection);
  //   this._workers.push(worker);

  //   return worker;
  // }

  async start () {
    await this.assertConnection();
  }

  async close () {
    if (!this.closePromise) {
      const close = async () => {
        if (this.connection) {
          await this.connection.close();
        }
      };

      this.closePromise = close();
    }
  }
}
