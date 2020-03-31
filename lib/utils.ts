import chalk from 'chalk';
import { VisitorAttrs, VisitorEntry } from './interfaces';

export const REDIS_CONSOLE_PREFIX = (messageType: string) =>
  `[ RATELIMIT:  ${messageType.padStart(8)} ] `;

// Redis' Key-length Reduction
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

// Verbose current session
export function groundedVerbose(entry: VisitorEntry, diffTime: number): void {
  // tslint:disable-next-line: no-console
  console.log(
    (entry.isGrounded === false
      ? `[ RATELIMIT:  ${chalk.green('PERMIT'.padStart(8))} ] `
      : `[ RATELIMIT:  ${chalk.red('GROUNDED'.padStart(8))} ] `) +
      `user_key: ${chalk.green(entry.key)}\t` +
      `X-RateLimit-Remaining: ${entry.attrs.remaining}\t` +
      `X-RateLimit-Reset: ${Math.floor(entry.attrs.exp / 1000000)}\t` +
      `taken_time: ${chalk.green(diffTime)}μs`
  );
}

// logger
export function logger(info: any): void {
  // tslint:disable-next-line: no-console
  console.log(info);
}

// microsecond to milisecond
export function micro_to_mili(microNumber: number): number {
  return Math.floor(microNumber / 1000000);
}
