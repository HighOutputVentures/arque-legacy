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
    this._callbacks = {};
  }

  get queue () {
    return (this._prefix || '') + this._job;
  }

  get callbackQueue () {
    return 'callback.' + this._id;
  }

  setConnection (connection) {
    this._connection = connection;
    delete this._assertChannel;
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
          const callback = this._callbacks[message.properties.correlationId];
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
      this._callbacks[correlationId] = result => {
        if (result.result) {
          resolve(result.result);
        } else {
          reject(new Error(result.error));
        }
        delete this._callbacks[correlationId];
      };
    });
  }
}
