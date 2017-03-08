'use strict';Object.defineProperty(exports, "__esModule", { value: true });var _amqplib = require('amqplib');var _amqplib2 = _interopRequireDefault(_amqplib);
var _worker = require('./worker');var _worker2 = _interopRequireDefault(_worker);
var _client = require('./client');var _client2 = _interopRequireDefault(_client);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return Promise.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};}

const MAX_CONNECTION_LISTENERS = 1000;

class Arque {
  constructor() {
    let options;
    if (typeof arguments[0] === 'string') {
      options = { url: arguments[0] };
    } else {
      options = arguments[0] || {};
    }

    this._url = options.url || 'amqp://localhost';
    this._prefix = options.prefix || '';

    this._workers = [];
  }

  assertConnection() {var _this = this;return _asyncToGenerator(function* () {
      if (!_this._assertConnection) {
        _this._assertConnection = _amqplib2.default.
        connect(_this._url).
        then(function (connection) {
          connection._maxListeners = MAX_CONNECTION_LISTENERS;
          connection.on('error', function () {
            delete _this._assertConnection;
            _this.startAllWorkers();
          });
          return connection;
        });
      }
      return yield _this._assertConnection;})();
  }

  startAllWorkers() {var _this2 = this;return _asyncToGenerator(function* () {
      let connection = yield _this2.assertConnection();
      yield Promise.all(_this2._workers.map(function (worker) {return worker.start(connection);}));})();
  }

  createWorker(options, handler) {var _this3 = this;return _asyncToGenerator(function* () {
      let worker = new _worker2.default(options, handler);
      let connection = yield _this3.assertConnection();
      yield worker.start(connection);
      _this3._workers.push(worker);

      return worker;})();
  }

  createClient(options, handler) {var _this4 = this;return _asyncToGenerator(function* () {
      let connection = yield _this4.assertConnection();
      let client = function () {
        const client = new _client2.default(options);
        client.setConnection(connection);
        return _asyncToGenerator(function* () {
          return yield client.exec.apply(client, arguments);
        });
      }();
      return client;})();
  }}exports.default = Arque;