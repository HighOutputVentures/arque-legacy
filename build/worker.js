'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _assert = require('assert');var _assert2 = _interopRequireDefault(_assert);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return Promise.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};}

class Worker {
  /**
               * @param {Object} options
               * @param {string} options.job
               * @param {string} [options.concurrency]
               * @param {function} handler
               */
  constructor(options, handler) {
    if (typeof options === 'string') {
      options = { job: options };
    }

    (0, _assert2.default)(options.job, 'Job name not specified');
    (0, _assert2.default)(typeof handler === 'function', 'Handler is not a function');
    this._job = options.job;
    this._concurrency = options.concurrency || 1;
    this._handler = handler;
    this._jobs = new Map();
  }

  get queue() {
    return (this._prefix || '') + this._job;
  }

  start(connection) {var _this = this;return _asyncToGenerator(function* () {
      let channel = yield connection.createChannel();

      yield channel.assertQueue(_this.queue, {
        durable: true });


      channel.prefetch(_this._concurrency);
      _this._channel = channel;
      const { consumerTag } = yield channel.consume(_this.queue, (() => {var _ref = _asyncToGenerator(function* (message) {
          const correlationId = message.properties.correlationId;
          const payload = JSON.parse(message.content);
          _this._jobs.set(correlationId, payload);

          let response;
          try {
            const result = yield _this._handler.apply(_this._handler, payload.arguments);
            response = { result };
          } catch (err) {
            const error = { message: err.message };
            for (const key in err) {
              error[key] = err[key];
            }
            response = { error };
          } finally {
            yield channel.ack(message);
          }

          yield channel.sendToQueue(
          message.properties.replyTo,
          new Buffer(JSON.stringify(response)),
          { correlationId });

          _this._jobs.delete(correlationId);

          if (_this._closeCallback && _this._jobs.size === 0) {
            _this._closeCallback();
          }
        });return function (_x) {return _ref.apply(this, arguments);};})());
      _this._consumerTag = consumerTag;})();
  }

  close() {var _this2 = this;return _asyncToGenerator(function* () {
      if (_this2._consumerTag) {
        const channel = _this2._channel;
        yield channel.cancel(_this2._consumerTag);

        yield new Promise(function (resolve) {
          _this2._closeCallback = resolve;
        });

        yield channel.close();
      }})();
  }}exports.default = Worker;