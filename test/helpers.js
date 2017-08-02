/* @flow */
import _ from 'lodash';

export function randString (
  length: number,
  charSpace: string = 'abcdefhgijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string {
  return _.reduce(_.range(length), accum => {
    const rand = Math.floor(Math.random() * charSpace.length);
    return accum + charSpace[rand];
  }, '');
}
