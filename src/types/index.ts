export type MappingEntry =
  | { type: 'ignore' }
  | { type: 'existing'; wfAccountId: string }
  | { type: 'create' };

export type AccountMapping = Record<number, MappingEntry>;
// Accounts absent from the map are treated as 'ignore'
