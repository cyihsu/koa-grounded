import chalk from 'chalk';
import { VisitorAttrs, VisitorEntry } from './interfaces';

// Redis' Key-length Reduction
export function iptoHex(IP: string): string {
    const ipHex: string = IP.split('.').reduce(
        (accumulator: number, current: string) => {
            const currentVal: number = parseInt(current, 10);
            if(currentVal > 255) {
                throw new Error('Given address contains invalid number');
            }
            return accumulator * 256 + currentVal
        }
        , 0).toString(16);
    return `0x${ipHex === '0' ? '00000000' : ipHex}`;
}

export function groundedVerbose(entry: VisitorEntry, diffTime: number): void {
    // tslint:disable-next-line: no-console
    console.log(
        (entry.isGrounded === false ? `[  RATELIMIT: ${chalk.green('PERMIT')}  ]  \t` : `[ RATELIMIT: ${chalk.red('GROUNDED')} ] \t`) +
        `user_key: ${chalk.green(entry.key)}\t` +
        `X-RateLimit-Remaining: ${entry.attrs.remaining}\t` +
        `X-RateLimit-Reset: ${Math.floor(entry.attrs.exp / 1000000)}\t` +
        `taken_time: ${chalk.green(diffTime)}μs`
    );
}