'use strict';Object.defineProperty(exports, "__esModule", { value: true });
var _uuid = require('uuid');var _uuid2 = _interopRequireDefault(_uuid);







var _error = require('./error');var _error2 = _interopRequireDefault(_error);
var _helpers = require('./helpers');function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return Promise.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};}

const CALLBACK_QUEUE_EXPIRATION = 600000;

class Client {







  constructor(arque, options)


  {
    this.arque = arque;

    this.options = {
      job: options.job,
      timeout: options.timeout || 60000 };


    this.callbacks = new Map();

    this.id = _uuid2.default.v4().replace(/-/g, '');
  }

  getQueueName() {
    return this.arque.options.prefix + this.options.job;
  }

  getCallbackQueueName() {
    return 'callback.' + this.id;
  }

  assertChannel() {var _this = this;return _asyncToGenerator(function* () {
      if (!_this.assertChannelPromise) {
        const assertChannel = (() => {var _ref = _asyncToGenerator(function* () {
            const connection = yield _this.arque.assertConnection();

            connection.once('close', function (err) {
              if (err) {
                delete _this.assertChannelPromise;
              }
            });
            const channel = yield connection.createChannel();

            yield channel.assertQueue(_this.getCallbackQueueName(), {
              exclusive: true,
              messageTtl: _this.options.timeout,
              expires: CALLBACK_QUEUE_EXPIRATION });


            yield channel.consume(_this.getCallbackQueueName(), (() => {var _ref2 = _asyncToGenerator(function* (message) {
                yield channel.ack(message);

                const correlationId = message.properties.correlationId;
                const response = JSON.parse(message.content.toString('utf8'));
                const callback = _this.callbacks.get(correlationId);
                if (callback) {
                  callback(response);
                }
              });return function (_x) {return _ref2.apply(this, arguments);};})());

            _this.channel = channel;
            return channel;
          });return function assertChannel() {return _ref.apply(this, arguments);};})();
        _this.assertChannelPromise = assertChannel();
      }

      return _this.assertChannelPromise;})();
  }

  execute(...args) {var _this2 = this;return _asyncToGenerator(function* () {
      if (_this2.closePromise) {
        throw new Error('Client is closing.');
      }

      let correlationId = _uuid2.default.v4().replace(/-/g, '');
      const request = {
        correlationId,
        arguments: args,
        timestamp: Date.now() };


      const promise = new Promise(function (resolve, reject) {
        const timeout = setTimeout(function () {
          _this2.callbacks.delete(correlationId);
          reject(new _error2.default('ERR_ARQUE_REQUEST_TIMEOUT', 'Request timeout.', {
            request,
            job: _this2.options.job }));

        }, _this2.options.timeout);

        const callback = function (response) {
          clearTimeout(timeout);
          if (typeof response.result !== 'undefined') {
            resolve(response.result);
          } else if (typeof response.error !== 'undefined') {
            const error = new Error(response.error.message);
            for (const key in response.error) {
              if (key === 'message') {
                continue;
              }
              // $FlowFixMe
              error[key] = response.error[key];
            }
            reject(error);
          }
          _this2.callbacks.delete(correlationId);
        };

        _this2.callbacks.set(correlationId, callback);
      });

      const channel = yield _this2.assertChannel();
      yield channel.sendToQueue(_this2.getQueueName(), new Buffer(JSON.stringify(request)), {
        correlationId,
        replyTo: _this2.getCallbackQueueName() });


      return promise;})();
  }

  close(force) {var _this3 = this;return _asyncToGenerator(function* () {
      if (!_this3.closePromise) {
        const close = (() => {var _ref3 = _asyncToGenerator(function* () {
            if (!force) {
              while (_this3.callbacks.size > 0) {
                yield (0, _helpers.delay)(250 + Math.random() * 250);
              }
            }

            if (_this3.channel) {
              yield _this3.channel.close();
            }
          });return function close() {return _ref3.apply(this, arguments);};})();

        _this3.closePromise = close();
      }

      yield _this3.closePromise;})();
  }}exports.default = Client;