export class RuleError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'RuleError'; this.code = code; }
}
export interface PackIssue {
  severity: 'ERROR'; code: string; packId: string; definitionId: string;
  pointer: string; reason: string; suggestion: string;
}
export class PackError extends Error {
  readonly issues: PackIssue[];
  constructor(issues: PackIssue[]) { super(issues.map(x => `${x.code} ${x.pointer}: ${x.reason}`).join('\n')); this.issues = issues; }
}
