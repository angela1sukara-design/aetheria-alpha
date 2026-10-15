import type { Id } from '../core/types.ts';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node;
}
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id); if (!node) throw new Error(`缺少 UI 元素 ${id}`); return node as T;
}
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
export function feedback(text: string, error = false): void {
  if (feedbackTimer) clearTimeout(feedbackTimer);
  const target = byId('feedback'); target.textContent = text; target.classList.toggle('error', error);
  target.setAttribute('role', error ? 'alert' : 'status');
  if (text && !error) feedbackTimer = setTimeout(() => { target.textContent = ''; }, 6000);
}
export function newSeed(): number { return crypto.getRandomValues(new Uint32Array(1))[0]; }
export function asId(text: string): Id { return text as Id; }

