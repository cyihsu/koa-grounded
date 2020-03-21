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
    return `0x${ipHex === "0" ? "00000000" : ipHex}`;
}
