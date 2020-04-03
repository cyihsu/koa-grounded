import chalk from 'chalk';
import { VisitorEntry } from './interfaces';

/***
 * Redis' Key-length Reduction
 * note: length of redis key might affect connection latency to redis,
 *       using hex as key might save 33% of data size
 */
export function iptoHex(IP: string): string {
  const ipHex: string = IP.split('.')
    .reduce((accumulator: number, current: string) => {
      const currentVal: number = parseInt(current, 10);
      if (currentVal > 255) {
        throw new Error('Given address contains invalid number');
      }
      return accumulator * 256 + currentVal;
    }, 0)
    .toString(16);
  return `0x${ipHex === '0' ? '00000000' : ipHex}`;
}

/***
 * Logger
 */
export function logger(
  verbose: boolean = false,
  subject: string,
  type: string,
  args: any
): void {
  if (verbose) {
    // tslint:disable-next-line: no-console
    console.log(
      `${_CONSOLE_PREFIX(subject)}${_loggerInfo[type].apply(null, args)}`
    );
  }
}

const _CONSOLE_PREFIX = (messageType: string) =>
  `RATELIMIT/${_MESSAGE_COLOR(messageType)}\t-> `;

const _MESSAGE_COLOR = (messageType: string) => {
  switch (messageType) {
    case 'GROUNDED':
      return chalk.red(messageType);
    case 'PERMIT':
      return chalk.red(messageType);
    default:
      return messageType;
  }
};

const _loggerInfo: any = {
  ERR: (ERR_MSG: any) => ERR_MSG,
  EXISTED_KEY: (key: string) =>
    `key: ${key} has existed on Redis, decrease instead.`,
  BANNED_KEY: (key: string) =>
    `key: ${key} has existed on Redis, but has already exceeds ratelimit.`,
  CREATED_KEY: (key: string) => `Written key: ${key} to Redis Server`,
  WRITTEN_MSG: (writtenCommandsSize: string) =>
    `Written ${writtenCommandsSize} commands to redis`,
  RECV_MSG: (channel: string, message: string) =>
    `RECV MESSAGE: ${channel}/${message}`,
  VERBOSE: (entry: VisitorEntry, diffTime: number) =>
    `user_key/ ${chalk.green(entry.key)}\t` +
    `RemainingToken/ ${entry.attrs.remaining}\t` +
    `ResetTime/ ${Math.floor(entry.attrs.exp / 1000000)}\t` +
    `taken_time/ ${chalk.green(diffTime)}μs`,
};

/***
 * Transform datatype
 */
export function micro_to_mili(microNumber: number): number {
  return Math.floor(microNumber / 1000000);
}

export function isExist(data: any): boolean {
  return typeof data !== 'undefined' && data !== null;
}
