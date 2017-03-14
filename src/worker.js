import assert from 'assert';

export default class Worker {
  /**
   * @param {Object} options
   * @param {string} options.job
   * @param {string} [options.concurrency]
   * @param {string} [options.prefix]
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
    this._prefix = options.prefix || '';

    this._handler = handler;
    this._jobs = new Map();
  }

  get queue () {
    return (this._prefix || '') + this._job;
  }

  async start (connection) {
    let channel = await connection.createChannel();
    this._channel = channel;
    await channel.assertQueue(this.queue, {
      durable: true
    });

    channel.prefetch(this._concurrency);

    const {consumerTag} = await channel.consume(this.queue, async message => {
      const correlationId = message.properties.correlationId;
      const payload = JSON.parse(message.content);
      this._jobs.set(correlationId, payload);

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

      await channel.sendToQueue(
        message.properties.replyTo,
        new Buffer(JSON.stringify(response)),
        {correlationId});

      this._jobs.delete(correlationId);

      if (this._closeCallback && this._jobs.size === 0) {
        this._closeCallback();
      }
    });
    this._consumerTag = consumerTag;
  }

  async close () {
    if (this._consumerTag) {
      const channel = this._channel;
      await channel.cancel(this._consumerTag);

      if (this._jobs.size > 0) {
        await new Promise(resolve => {
          this._closeCallback = resolve;
        });
      }

      await channel.close();
    }
  }
}
