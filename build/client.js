'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _assert = require('assert');var _assert2 = _interopRequireDefault(_assert);
var _uuid = require('uuid');var _uuid2 = _interopRequireDefault(_uuid);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return Promise.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};}

class Client {
  /**
               * @param {Object} options
               * @param {string} options.job
               * @param {function} handler
               */
  constructor(options) {
    if (typeof options === 'string') {
      options = { job: options };
    }
    (0, _assert2.default)(options.job, 'Job name not specified');
    this._job = options.job;

    this._id = _uuid2.default.v4().replace(/-/g, '');
    this._callbacks = {};
  }

  get queue() {
    return (this._prefix || '') + this._job;
  }

  get callbackQueue() {
    return 'callback.' + this._id;
  }

  setConnection(connection) {
    this._connection = connection;
    delete this._assertChannel;
  }

  assertChannel() {var _this = this;return _asyncToGenerator(function* () {
      if (!_this._assertChannel) {
        const assertChannel = (() => {var _ref = _asyncToGenerator(function* () {
            const channel = yield _this._connection.createChannel();
            yield channel.assertQueue(_this.callbackQueue, {
              exclusive: true });

            channel.consume(_this.callbackQueue, (() => {var _ref2 = _asyncToGenerator(function* (message) {
                channel.ack(message);
                const payload = JSON.parse(message.content);
                const callback = _this._callbacks[message.properties.correlationId];
                if (callback) {
                  callback(payload);
                }
              });return function (_x) {return _ref2.apply(this, arguments);};})());
            return channel;
          });return function assertChannel() {return _ref.apply(this, arguments);};})();
        _this._assertChannel = assertChannel();
      }

      return yield _this._assertChannel;})();
  }

  exec() {var _arguments = arguments,_this2 = this;return _asyncToGenerator(function* () {
      let correlationId = _uuid2.default.v4().replace(/-/g, '');
      let payload = {
        arguments: [].slice.call(_arguments) };


      const channel = yield _this2.assertChannel();
      channel.sendToQueue(
      _this2.queue,
      new Buffer(JSON.stringify(payload)),
      { correlationId, replyTo: _this2.callbackQueue });


      return yield new Promise(function (resolve, reject) {
        _this2._callbacks[correlationId] = function (result) {
          if (result.result) {
            resolve(result.result);
          } else {
            reject(new Error(result.error));
          }
          delete _this2._callbacks[correlationId];
        };
      });})();
  }}exports.default = Client;