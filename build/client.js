'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _assert = require('assert');var _assert2 = _interopRequireDefault(_assert);
var _uuid = require('uuid');var _uuid2 = _interopRequireDefault(_uuid);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return Promise.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};}

class Client {
  /**
               * @param {Object} options
               * @param {string} options.job
               * @param {string} [options.timeout]
               * @param {string} [options.prefix]
               * @param {function} handler
               */
  constructor(options) {
    if (typeof options === 'string') {
      options = { job: options };
    }

    (0, _assert2.default)(options.job, 'Job name not specified');

    this._job = options.job;
    this._timeout = options.timeout || 50000;
    this._prefix = options.prefix || '';

    this._id = _uuid2.default.v4().replace(/-/g, '');
    this.reset();
  }

  get queue() {
    return (this._prefix || '') + this._job;
  }

  get callbackQueue() {
    return 'callback.' + this._id;
  }

  reset() {
    delete this._assertChannel;
    this._callbacks = new Map();
  }

  setConnection(connection) {
    this._connection = connection;
    this.reset();
  }

  assertChannel() {var _this = this;return _asyncToGenerator(function* () {
      if (!_this._assertChannel) {
        const assertChannel = (() => {var _ref = _asyncToGenerator(function* () {
            const channel = yield _this._connection.createChannel();
            yield channel.assertQueue(_this.callbackQueue, {
              exclusive: true });

            channel.consume(_this.callbackQueue, (() => {var _ref2 = _asyncToGenerator(function* (message) {
                const correlationId = message.properties.correlationId;
                channel.ack(message);
                const payload = JSON.parse(message.content);
                const callback = _this._callbacks.get(correlationId);
                if (callback) {
                  callback(payload);
                }
              });return function (_x) {return _ref2.apply(this, arguments);};})());
            _this._channel = channel;
            return channel;
          });return function assertChannel() {return _ref.apply(this, arguments);};})();
        _this._assertChannel = assertChannel();
      }

      return yield _this._assertChannel;})();
  }

  exec() {var _this2 = this,_arguments = arguments;return _asyncToGenerator(function* () {
      if (_this2._closeCallback) {
        throw new Error('Client is closing');
      }
      let correlationId = _uuid2.default.v4().replace(/-/g, '');
      let payload = {
        arguments: [].slice.call(_arguments) };


      const promise = new Promise(function (resolve, reject) {
        const timeout = setTimeout(function () {
          _this2.deleteCallback(correlationId);
          const error = new Error('Job timeout.');
          error.code = 'TIMEOUT';
          error.correlationId = correlationId;
          error.job = _this2._job;
          reject(error);
        }, _this2._timeout);
        _this2._callbacks.set(correlationId, function (payload) {
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
          _this2.deleteCallback(correlationId);
        });
      });

      const channel = yield _this2.assertChannel();
      yield channel.sendToQueue(
      _this2.queue,
      new Buffer(JSON.stringify(payload)),
      { correlationId, replyTo: _this2.callbackQueue });


      return yield promise;})();
  }

  deleteCallback(correlationId) {
    delete this._callbacks.delete(correlationId);
    if (this._closeCallback && this._callbacks.size === 0) {
      this._closeCallback();
    }
  }

  close() {var _this3 = this;return _asyncToGenerator(function* () {
      if (_this3._callbacks.size > 0) {
        yield new Promise(function (resolve) {
          _this3._closeCallback = resolve;
        });
      }

      if (_this3._channel) {
        yield _this3._channel.close();
      }})();
  }}exports.default = Client;