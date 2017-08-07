'use strict';Object.defineProperty(exports, "__esModule", { value: true });class ArqueError extends Error {


  constructor(code, message, meta = {}) {
    super(message);
    this.code = code;
    this.name = 'ArqueError';
    this.meta = meta;
  }}exports.default = ArqueError;