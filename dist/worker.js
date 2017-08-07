'use strict';Object.defineProperty(exports, "__esModule", { value: true });




var _helpers = require('./helpers');function _asyncToGenerator(fn) {return function () {var gen = fn.apply(this, arguments);return new Promise(function (resolve, reject) {function step(key, arg) {try {var info = gen[key](arg);var value = info.value;} catch (error) {reject(error);return;}if (info.done) {resolve(value);} else {return Promise.resolve(value).then(function (value) {step("next", value);}, function (err) {step("throw", err);});}}return step("next");});};}

class Worker {







  constructor(arque, options,


  handler) {
    this.arque = arque;

    this.options = {
      job: options.job,
      concurrency: options.concurrency || 1 };


    this.handler = handler;

    this.jobs = new Map();
  }

  getQueueName() {
    return this.arque.options.prefix + this.options.job;
  }

  reconnect() {var _this = this;
    delete this.startPromise;
    delete this.channel;
    this.start().catch(_asyncToGenerator(function* () {
      yield (0, _helpers.delay)(2000 + Math.random() * 500);
      _this.reconnect();
    }));
  }

  start() {var _this2 = this;return _asyncToGenerator(function* () {
      if (!_this2.startPromise) {
        const start = (() => {var _ref2 = _asyncToGenerator(function* () {
            const connection = yield _this2.arque.assertConnection();

            connection.once('close', (() => {var _ref3 = _asyncToGenerator(function* (err) {
                if (err) {
                  _this2.reconnect();
                }
              });return function (_x) {return _ref3.apply(this, arguments);};})());
            connection.once('error', _asyncToGenerator(function* () {
              _this2.reconnect();
            }));

            const channel = yield connection.createChannel();
            _this2.channel = channel;

            yield channel.assertQueue(_this2.getQueueName(), {
              durable: true });


            channel.prefetch(_this2.options.concurrency);

            const { consumerTag } = yield channel.consume(_this2.getQueueName(), (() => {var _ref5 = _asyncToGenerator(function* (message) {
                const correlationId = message.properties.correlationId;

                const payload = JSON.parse(message.content.toString());
                _this2.jobs.set(correlationId, payload);

                let response;
                try {
                  const result = yield _this2.handler.apply(_this2.handler, payload.arguments);
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

                _this2.jobs.delete(correlationId);
              });return function (_x2) {return _ref5.apply(this, arguments);};})());

            _this2.consumerTag = consumerTag;
          });return function start() {return _ref2.apply(this, arguments);};})();

        _this2.startPromise = start();
      }

      return _this2.startPromise;})();
  }

  close(force) {var _this3 = this;return _asyncToGenerator(function* () {
      return _this3.stop(force);})();
  }
  stop(force) {var _this4 = this;return _asyncToGenerator(function* () {
      if (_this4.consumerTag && _this4.channel) {
        yield _this4.channel.cancel(_this4.consumerTag);
      }

      if (!force) {
        while (_this4.jobs.size > 0) {
          yield (0, _helpers.delay)(100 + Math.random() * 100);
        }
      }

      if (_this4.channel) {
        yield _this4.channel.close();
      }})();
  }}exports.default = Worker;