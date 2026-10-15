/** 名称只表示身份；不会由性别、身体形态或关系阶段推导姓氏。 */
export interface NameCulture {
  id: string;
  familyNames: string[];
  order: 'family-given' | 'given-family' | 'single';
  separator: '' | '·' | ' ';
  defaultInheritance: 'parentA' | 'parentB' | 'compound' | 'none';
}
export interface PersonalName {
  cultureId: string;
  givenName: string;
  familyNames: string[];
  order: NameCulture['order'];
  separator: NameCulture['separator'];
}
export type SurnameRule =
  | {kind: 'parent'; parentId: string}
  | {kind: 'household'; familyNames: string[]}
  | {kind: 'compound'; sources: {parentId: string; familyIndex: number}[]}
  | {kind: 'none'};
