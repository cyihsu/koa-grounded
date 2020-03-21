// Redis' Key-length Reduction
export function iptoHex(IP: string): string {
    const ipHex: string = IP.split('.').reduce(
        (accumulator: number, current: string) =>
            accumulator * 256 + parseInt(current, 10)
        , 0).toString(16);
    return `0x${ipHex === "0" ? "00000000" : ipHex}`;
}
