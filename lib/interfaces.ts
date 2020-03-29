import IORedis from 'ioredis';

export interface GroundedConfigs {
  ratelimit: number;
  globalEXP: number;
  timeout: number;
  localThreshold: number;
  db: IORedis.Redis;
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
