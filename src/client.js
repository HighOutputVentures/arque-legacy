import assert from 'assert';
import uuid from 'uuid';

export default class Client {
  /**
   * @param {Object} options
   * @param {string} options.job
   * @param {string} [options.timeout]
   * @param {function} handler
   */
  constructor (options) {
    if (typeof options === 'string') {
      options = {job: options};
    }

    assert(options.job, 'Job name not specified');
    this._job = options.job;
    this._timeout = options.timeout || 50000;

    this._id = uuid.v4().replace(/-/g, '');
    this.reset();
  }

  get queue () {
    return (this._prefix || '') + this._job;
  }

  get callbackQueue () {
    return 'callback.' + this._id;
  }

  reset () {
    delete this._assertChannel;
    this._callbacks = new Map();
  }

  setConnection (connection) {
    this._connection = connection;
    this.reset();
  }

  async assertChannel () {
    if (!this._assertChannel) {
      const assertChannel = async () => {
        const channel = await this._connection.createChannel();
        await channel.assertQueue(this.callbackQueue, {
          exclusive: true
        });
        channel.consume(this.callbackQueue, async message => {
          const correlationId = message.properties.correlationId;
          channel.ack(message);
          const payload = JSON.parse(message.content);
          const callback = this._callbacks.get(correlationId);
          if (callback) {
            callback(payload);
          }
        });
        return channel;
      };
      this._assertChannel = assertChannel();
    }

    return await this._assertChannel;
  }

  async exec () {
    if (this._closeCallback) {
      throw new Error('Client is closing');
    }
    let correlationId = uuid.v4().replace(/-/g, '');
    let payload = {
      arguments: [].slice.call(arguments)
    };

    const channel = await this.assertChannel();
    await channel.sendToQueue(
      this.queue,
      new Buffer(JSON.stringify(payload)),
      {correlationId, replyTo: this.callbackQueue}
    );

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.deleteCallback(correlationId);
        const error = new Error('Job timeout.');
        error.code = 'TIMEOUT';
        error.correlationId = correlationId;
        error.job = this._job;
        reject(error);
      }, this._timeout);
      this._callbacks.set(correlationId, payload => {
        clearTimeout(timeout);
        if (payload.result) {
          resolve(payload.result);
        } else {
          const error = new Error(payload.error.message);
          for (const key in payload.error) {
            if (key === 'message') {
              continue;
            }
            error[key] = payload.error[key];
          }
          reject(error);
        }
        this.deleteCallback(correlationId);
      });
    });
  }

  deleteCallback (correlationId) {
    delete this._callbacks.delete(correlationId);
    if (this._closeCallback && this._callbacks.size === 0) {
      this._closeCallback();
    }
  }

  async close () {
    await new Promise(resolve => {
      this._closeCallback = resolve;
    });

    const channel = await this.assertChannel();
    await channel.close();
  }
}
