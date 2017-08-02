export default class ArqueError extends Error {
  code: string
  meta: mixed
  constructor (code: string, message: string, meta: mixed = {}) {
    super(message);
    this.code = code;
    this.name = 'ArqueError';
    this.meta = meta;
  }
}
