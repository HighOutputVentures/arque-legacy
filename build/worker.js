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
  }

  get queue() {
    return (this._prefix || '') + this._job;
  }

  start(connection) {var _this = this;return _asyncToGenerator(function* () {
      let channel = yield connection.createChannel();

      yield channel.assertQueue(_this.queue, {
        durable: true });


      channel.prefetch(_this._concurrency);
      yield channel.consume(_this.queue, (() => {var _ref = _asyncToGenerator(function* (message) {
          yield channel.ack(message);
          const payload = JSON.parse(message.content);
          let result;
          try {
            result = {
              result: yield _this._handler.apply(_this._handler, payload.arguments) };

          } catch (err) {
            result = {
              error: err.message };

          }

          channel.sendToQueue(
          message.properties.replyTo,
          new Buffer(JSON.stringify(result)),
          { correlationId: message.properties.correlationId });
        });return function (_x) {return _ref.apply(this, arguments);};})());})();
  }}exports.default = Worker;