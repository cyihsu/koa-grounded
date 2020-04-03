export interface GroundedConfigs {
  partitionKey: string;
  ratelimit: number;
  globalEXP: number;
  timeout: number;
  cacheSize: number;
  dbStr: string;
  verbose?: boolean;
}

export interface VisitorEntry {
  key: string;
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
