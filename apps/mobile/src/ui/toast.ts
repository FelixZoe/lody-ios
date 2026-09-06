import { useSyncExternalStore } from 'react';

export const TOAST_DISMISS_MS = 2600;

export type Toast = { id: number; message: string };

const listeners = new Set<() => void>();
let toast: Toast | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function clearTimer() {
  if (timer === null) return;
  clearTimeout(timer);
  timer = null;
}

export function getToast() {
  return toast;
}

export function dismissToast() {
  clearTimer();
  if (toast === null) return;
  toast = null;
  emit();
}

export function showToast(message: string) {
  clearTimer();
  toast = { id: nextId++, message };
  timer = setTimeout(dismissToast, TOAST_DISMISS_MS);
  emit();
}

export function useToast() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getToast,
    getToast,
  );
}
