'use strict';Object.defineProperty(exports, "__esModule", { value: true });
var _amqplib = require('amqplib');var _amqplib2 = _interopRequireDefault(_amqplib);





var _client = require('./client');var _client2 = _interopRequireDefault(_client);
var _worker = require('./worker');var _worker2 = _interopRequireDefault(_worker);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return Promise.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};}

class Arque {




  constructor(options) {
    if (typeof options === 'string') {
      this.options = { uri: options, prefix: '' };
    } else if (typeof options === 'undefined') {
      this.options = { uri: 'amqp://127.0.0.1', prefix: '' };
    } else {
      this.options = {
        uri: options.uri,
        prefix: options.prefix || '' };

    }
  }

  assertConnection() {var _this = this;return _asyncToGenerator(function* () {
      if (!_this.assertConnectionPromise) {
        const assertConnection = (() => {var _ref = _asyncToGenerator(function* () {
            const connection = yield _amqplib2.default.connect(_this.options.uri);
            connection.setMaxListeners(1000);

            connection.on('close', function () {
              delete _this.connection;
              delete _this.assertConnectionPromise;
            });
            _this.connection = connection;
            return connection;
          });return function assertConnection() {return _ref.apply(this, arguments);};})();
        _this.assertConnectionPromise = assertConnection();
        _this.assertConnectionPromise.catch(function () {
          delete _this.assertConnectionPromise;
        });
      }

      return _this.assertConnectionPromise;})();
  }

  createClient(options) {var _this2 = this;return _asyncToGenerator(function* () {
      let params;
      if (typeof options === 'string') {
        params = { job: options, timeout: 60000 };
      } else {
        params = { job: options.job, timeout: options.timeout || 60000 };
      }

      const client = new _client2.default(_this2, params);

      const clientFunc = (() => {var _ref2 = _asyncToGenerator(function* () {
          return yield client.execute.apply(client, arguments);
        });return function clientFunc() {return _ref2.apply(this, arguments);};})();

      clientFunc.close = _asyncToGenerator(function* () {
        yield client.close.apply(client);
      });

      return clientFunc;})();
  }

  createWorker(options, handler) {var _this3 = this;return _asyncToGenerator(function* () {
      let params;
      if (typeof options === 'string') {
        params = { job: options, concurrency: 1 };
      } else {
        params = { job: options.job, concurrency: options.concurrency || 1 };
      }

      let worker = new _worker2.default(_this3, params, handler);
      yield worker.start();

      return worker;})();
  }

  start() {var _this4 = this;return _asyncToGenerator(function* () {
      yield _this4.assertConnection();})();
  }

  close() {var _this5 = this;return _asyncToGenerator(function* () {
      return _this5.stop();})();
  }
  stop() {var _this6 = this;return _asyncToGenerator(function* () {
      if (!_this6.closePromise) {
        const close = (() => {var _ref4 = _asyncToGenerator(function* () {
            if (_this6.connection) {
              yield _this6.connection.close();
            }
          });return function close() {return _ref4.apply(this, arguments);};})();

        _this6.closePromise = close();
      }})();
  }}exports.default = Arque;