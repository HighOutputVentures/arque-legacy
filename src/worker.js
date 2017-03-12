import assert from 'assert';

export default class Worker {
  /**
   * @param {Object} options
   * @param {string} options.job
   * @param {string} [options.concurrency]
   * @param {function} handler
   */
  constructor (options, handler) {
    if (typeof options === 'string') {
      options = {job: options};
    }

    assert(options.job, 'Job name not specified');
    assert(typeof handler === 'function', 'Handler is not a function');
    this._job = options.job;
    this._concurrency = options.concurrency || 1;
    this._handler = handler;
  }

  get queue () {
    return (this._prefix || '') + this._job;
  }

  async start (connection) {
    let channel = await connection.createChannel();

    await channel.assertQueue(this.queue, {
      durable: true
    });

    channel.prefetch(this._concurrency);
    this._channel = channel;
    const {consumerTag} = await channel.consume(this.queue, async message => {
      const payload = JSON.parse(message.content);
      let response;
      try {
        const result = await this._handler.apply(this._handler, payload.arguments);
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

      channel.sendToQueue(
        message.properties.replyTo,
        new Buffer(JSON.stringify(response)),
        {correlationId: message.properties.correlationId});
    });
    this._consumerTag = consumerTag;
  }

  async close () {
    if (this._consumerTag) {
      this._channel.cancel(this._consumerTag);
    }
  }
}
