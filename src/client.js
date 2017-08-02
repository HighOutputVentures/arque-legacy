/* @flow */
import uuid from 'uuid';

import type {
  AMQPChannel,
  ArqueRequest,
  ArqueResponse,
  IArque
} from './types';
import ArqueError from './error';
import {delay} from './helpers';

const CALLBACK_QUEUE_EXPIRATION = 600000;

export default class Client {
  arque: IArque
  options: {job: string, timeout: number}
  id: string
  callbacks: Map<string, ArqueResponse => void>
  channel: AMQPChannel
  assertChannelPromise: Promise<AMQPChannel>
  closePromise: Promise<void>
  constructor (arque: IArque, options: {
    job: string,
    timeout?: number
  }) {
    this.arque = arque;

    this.options = {
      job: options.job,
      timeout: options.timeout || 60000
    };

    this.callbacks = new Map();

    this.id = uuid.v4().replace(/-/g, '');
  }

  getQueueName (): string {
    return this.arque.options.prefix + this.options.job;
  }

  getCallbackQueueName (): string {
    return 'callback.' + this.id;
  }

  async assertChannel (): Promise<AMQPChannel> {
    if (!this.assertChannelPromise) {
      const assertChannel = async () => {
        const connection = await this.arque.assertConnection();

        connection.once('close', err => {
          if (err) {
            delete this.assertChannelPromise;
          }
        });
        const channel: AMQPChannel = await connection.createChannel();

        await channel.assertQueue(this.getCallbackQueueName(), {
          exclusive: true,
          messageTtl: this.options.timeout,
          expires: CALLBACK_QUEUE_EXPIRATION
        });

        await channel.consume(this.getCallbackQueueName(), async message => {
          await channel.ack(message);

          const correlationId = message.properties.correlationId;
          const response: ArqueResponse = JSON.parse(message.content.toString('utf8'));
          const callback = this.callbacks.get(correlationId);
          if (callback) {
            callback(response);
          }
        });

        this.channel = channel;
        return channel;
      };
      this.assertChannelPromise = assertChannel();
    }

    return this.assertChannelPromise;
  }

  async execute (...args: Array<mixed>): Promise<any> {
    if (this.closePromise) {
      throw new Error('Client is closing.');
    }

    let correlationId = uuid.v4().replace(/-/g, '');
    const request: ArqueRequest = {
      correlationId,
      arguments: args,
      timestamp: Date.now()
    };

    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.callbacks.delete(correlationId);
        reject(new ArqueError('ERR_ARQUE_REQUEST_TIMEOUT', 'Request timeout.', {
          request,
          job: this.options.job
        }));
      }, this.options.timeout);

      const callback = (response: ArqueResponse) => {
        clearTimeout(timeout);
        if (typeof response.result !== 'undefined') {
          resolve(response.result);
        } else if (typeof response.error !== 'undefined') {
          const error = new Error(response.error.message);
          for (const key in response.error) {
            if (key === 'message') {
              continue;
            }
            // $FlowFixMe
            error[key] = response.error[key];
          }
          reject(error);
        }
        this.callbacks.delete(correlationId);
      };

      this.callbacks.set(correlationId, callback);
    });

    const channel = await this.assertChannel();
    await channel.sendToQueue(this.getQueueName(), new Buffer(JSON.stringify(request)), {
      correlationId,
      replyTo: this.getCallbackQueueName()
    });

    return promise;
  }

  async close (force?: boolean): Promise<void> {
    if (!this.closePromise) {
      const close = async () => {
        if (!force) {
          while (this.callbacks.size > 0) {
            await delay(250 + Math.random() * 250);
          }
        }

        if (this.channel) {
          await this.channel.close();
        }
      };

      this.closePromise = close();
    }

    await this.closePromise;
  }
}
