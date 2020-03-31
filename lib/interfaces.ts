import IORedis from 'ioredis';

export interface GroundedConfigs {
  ratelimit: number;
  globalEXP: number;
  timeout: number;
  cacheSize: number;
  localThreshold: number;
  dbStr: string;
  verbose?: boolean;
}

export interface VisitorEntry {
  key: string;
  isGrounded: boolean;
  attrs: VisitorAttrs;
}

export interface VisitorAttrs {
  remaining: number;
  uat: number;
  exp: number;
}

// macro_name => macro_filename
export const GroundedMacros = [
  {
    name: 'createKey',
    filename: 'create_key',
    key_num: 1,
  },
  {
    name: 'visitKey',
    filename: 'visit_key',
    key_num: 1,
  },
];
