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
    await channel.consume(this.queue, async message => {
      const payload = JSON.parse(message.content);
      let response;
      try {
        response = {
          result: await this._handler.apply(this._handler, payload.arguments)
        };
      } catch (err) {
        response = {
          error: err.message
        };
      } finally {
        await channel.ack(message);
      }

      channel.sendToQueue(
        message.properties.replyTo,
        new Buffer(JSON.stringify(response)),
        {correlationId: message.properties.correlationId});
    });
  }
}
