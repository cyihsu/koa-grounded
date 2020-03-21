// Redis Key-length Reduction
export function iptoHex(IP: string): string {
    return `0x${IP.split('.').reduce(
        (accumulator: number, current: string) =>
        accumulator * 256 + parseInt(current, 10)
    , 0).toString(16)}`
}
