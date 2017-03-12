import assert from 'assert';
import uuid from 'uuid';

export default class Client {
  /**
   * @param {Object} options
   * @param {string} options.job
   * @param {function} handler
   */
  constructor (options) {
    if (typeof options === 'string') {
      options = {job: options};
    }
    assert(options.job, 'Job name not specified');
    this._job = options.job;

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
          channel.ack(message);
          const payload = JSON.parse(message.content);
          const callback = this._callbacks.get(message.properties.correlationId);
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
    channel.sendToQueue(
      this.queue,
      new Buffer(JSON.stringify(payload)),
      {correlationId, replyTo: this.callbackQueue}
    );

    return await new Promise((resolve, reject) => {
      this._callbacks.set(correlationId, payload => {
        if (payload.result) {
          resolve(payload.result);
        } else {
          reject(new Error(payload.error));
        }
        delete this._callbacks.delete(correlationId);
        if (this._closeCallback && this._callbacks.size === 0) {
          this._closeCallback();
        }
      });
    });
  }

  async close () {
    await new Promise(resolve => {
      this._closeCallback = resolve;
    });

    const channel = await this.assertChannel();
    await channel.close();
  }
}
