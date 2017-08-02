/* @flow */

import type {
  AMQPChannel,
  IArque
} from './types';
import {delay} from './helpers';

export default class Worker {
  arque: IArque
  options: {job: string, concurrency: number}
  handler: Function => Promise<any>
  jobs: Map<string, any>
  consumerTag: string
  startPromise: Promise<void>
  channel: AMQPChannel
  constructor (arque: IArque, options: {
    job: string,
    concurrency?: number
  }, handler: Function) {
    this.arque = arque;

    this.options = {
      job: options.job,
      concurrency: options.concurrency || 1
    };

    this.handler = handler;

    this.jobs = new Map();
  }

  getQueueName (): string {
    return this.arque.options.prefix + this.options.job;
  }

  async start (): Promise<void> {
    if (!this.startPromise) {
      const start = async () => {
        const connection = await this.arque.assertConnection();
        const channel = await connection.createChannel();
        this.channel = channel;

        await channel.assertQueue(this.getQueueName(), {
          durable: true
        });

        channel.prefetch(this.options.concurrency);

        const {consumerTag} = await channel.consume(this.getQueueName(), async message => {
          const correlationId = message.properties.correlationId;

          const payload = JSON.parse(message.content.toString());
          this.jobs.set(correlationId, payload);

          let response;
          try {
            const result = await this.handler.apply(this.handler, payload.arguments);
            response = {result};
          } catch (err) {
            const error = {message: err.message};
            for (const key in err) {
              error[key] = err[key];
            }
            response = {error};
          } finally {
            await channel.ack(message);
          }

          await channel.sendToQueue(
            message.properties.replyTo,
            new Buffer(JSON.stringify(response)),
            {correlationId});

          this.jobs.delete(correlationId);
        });

        this.consumerTag = consumerTag;
      };

      this.startPromise = start();
    }

    return this.startPromise;
  }

  async close (force?: boolean): Promise<void> {
    return this.stop(force);
  }
  async stop (force?: boolean): Promise<void> {
    if (this.consumerTag && this.channel) {
      await this.channel.cancel(this.consumerTag);
    }

    if (!force) {
      while (this.jobs.size > 0) {
        await delay(250 + Math.random() * 250);
      }
    }

    if (this.channel) {
      await this.channel.close();
    }
  }
}
