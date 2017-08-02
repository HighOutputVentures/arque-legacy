/* @flow */
import amqp from 'amqplib';

import type {
  AMQPConnection,
  IArque
} from './types';
import Client from './client';
import Worker from './worker';

export default class Arque implements IArque {
  options: {uri: string, prefix: string}
  assertConnectionPromise: Promise<AMQPConnection>
  closePromise: Promise<void>
  connection: AMQPConnection
  constructor (options: string | {uri: string, prefix?: string}) {
    if (typeof options === 'string') {
      this.options = {uri: options, prefix: ''};
    } else if (typeof options === 'undefined') {
      this.options = {uri: 'amqp://127.0.0.1', prefix: ''};
    } else {
      this.options = {
        uri: options.uri,
        prefix: options.prefix || ''
      };
    }
  }

  async assertConnection (): Promise<AMQPConnection> {
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

  async createClient (options: string | {job: string, timeout?: number}) {
    let params;
    if (typeof options === 'string') {
      params = {job: options, timeout: 60000};
    } else {
      params = {job: options.job, timeout: options.timeout || 60000};
    }

    const client = new Client(this, params);

    const clientFunc = async function () {
      return await client.execute.apply(client, arguments);
    };

    clientFunc.close = async function () {
      await client.close.apply(client);
    };

    return clientFunc;
  }

  async createWorker (options: string | {job: string, concurrency?: number}, handler: Function) {
    let params;
    if (typeof options === 'string') {
      params = {job: options, concurrency: 1};
    } else {
      params = {job: options.job, concurrency: options.concurrency || 1};
    }

    let worker = new Worker(this, params, handler);
    await worker.start();

    return worker;
  }

  async start () {
    await this.assertConnection();
  }

  async close (): Promise<void> {
    return this.stop();
  }
  async stop (): Promise<void> {
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
