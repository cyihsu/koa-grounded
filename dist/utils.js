"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Redis' Key-length Reduction
function iptoHex(IP) {
    const ipHex = IP.split('.').reduce((accumulator, current) => {
        const currentVal = parseInt(current, 10);
        if (currentVal > 255) {
            throw new Error('Given address contains invalid number');
        }
        return accumulator * 256 + currentVal;
    }, 0).toString(16);
    return `0x${ipHex === "0" ? "00000000" : ipHex}`;
}
exports.iptoHex = iptoHex;
