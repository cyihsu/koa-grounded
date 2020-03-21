import { assert, expect } from 'chai';

import { iptoHex } from '../src/utils';
describe('utils', () => {
    describe('iptoHex', () => {
        it('should represent IP address as a hexadecimal string', () => {
          assert.equal(iptoHex('192.168.0.1'), '0xc0a80001');
        });

        it('should correctly shown on boundaries', () => {
          assert.equal(iptoHex('0.0.0.0'), '0x00000000');
          assert.equal(iptoHex('255.255.255.255'), '0xffffffff');
        });

        it('should throw error on invalid address numbers', () => {
            expect(() => iptoHex('0.256.0.0')).to.throw();
          });
      });
})
