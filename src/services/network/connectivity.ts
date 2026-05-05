import { AppState, type AppStateStatus } from 'react-native';

type ConnectivityListener = (isOnline: boolean) => void;

const listeners = new Set<ConnectivityListener>();

let online = true;
let monitorStarted = false;
let unsubscribeAppState: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

async function probeNetwork(): Promise<boolean> {
  // For native, a lightweight HTTP probe is used.
  // For web, navigator.onLine is a cheap first signal.
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false) {
    return false;
  }

  try {
    const response = await fetch('https://clients3.google.com/generate_204', {
      method: 'GET',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

function publish(nextOnline: boolean): void {
  if (online === nextOnline) {
    return;
  }

  online = nextOnline;
  for (const listener of listeners) {
    listener(online);
  }
}

async function refreshConnectivity(): Promise<void> {
  const nextOnline = await probeNetwork();
  publish(nextOnline);
}

function handleAppStateChange(status: AppStateStatus): void {
  if (status === 'active') {
    void refreshConnectivity();
  }
}

export function startConnectivityMonitoring(pollIntervalMs = 15000): void {
  if (monitorStarted) {
    return;
  }

  monitorStarted = true;

  void refreshConnectivity();
  timer = setInterval(() => {
    void refreshConnectivity();
  }, pollIntervalMs);

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  unsubscribeAppState = () => subscription.remove();
}

export function stopConnectivityMonitoring(): void {
  if (!monitorStarted) {
    return;
  }

  monitorStarted = false;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (unsubscribeAppState) {
    unsubscribeAppState();
    unsubscribeAppState = null;
  }
}

export function isOnline(): boolean {
  return online;
}

export function subscribeConnectivity(listener: ConnectivityListener): () => void {
  listeners.add(listener);
  listener(online);

  return () => {
    listeners.delete(listener);
  };
}
