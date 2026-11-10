export type BridgeStatus = 'starting' | 'live' | 'challenge' | 'offline';

export interface BridgeSnapshot {
  status: BridgeStatus;
  lastError: string | null;
}

export interface BridgeRequest {
  id: string;
  path: string;
}

export interface BridgeResult {
  status: number;
  body: string;
}

export interface BridgeTransport {
  send(request: BridgeRequest): void;
  reload(): void;
}

type Waiter = {
  id: string;
  path: string;
  resolve: (result: BridgeResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  challengeRetries: number;
};

const listeners = new Set<(snapshot: BridgeSnapshot) => void>();
let snapshot: BridgeSnapshot = { status: 'starting', lastError: null };

export function getBridgeSnapshot(): BridgeSnapshot {
  return snapshot;
}

export function publishBridge(next: BridgeSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}

export function subscribeBridge(listener: (snapshot: BridgeSnapshot) => void) {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function isChallengeBody(body: string): boolean {
  return /"reason"\s*:\s*"challenge"/i.test(body) || /challenge/i.test(body);
}

/**
 * Queues Sofascore reads until the hidden page says it is ready.
 * A 403 challenge reloads the page once, then retries that request.
 */
export class SofaBridge {
  private ready = false;
  private seq = 0;
  private readonly waiters = new Map<string, Waiter>();
  private queue: BridgeRequest[] = [];
  private readonly timeoutMs: number;

  constructor(private readonly transport: BridgeTransport, timeoutMs = 20_000) {
    this.timeoutMs = timeoutMs;
  }

  snapshot(): BridgeSnapshot {
    return getBridgeSnapshot();
  }

  enqueue(path: string): Promise<BridgeResult> {
    const id = `s${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.finish(id, () => {
          this.publish('offline', 'Sofascore bridge timed out');
          reject(new Error('Sofascore bridge timed out'));
        });
      }, this.timeoutMs);
      this.waiters.set(id, { id, path, resolve, reject, timer, challengeRetries: 0 });
      if (this.ready) this.transport.send({ id, path });
      else this.queue.push({ id, path });
    });
  }

  noteChallenge() {
    this.ready = false;
    this.publish('challenge', 'Blocked 403 challenge');
  }

  markOffline(detail: string) {
    this.ready = false;
    this.publish('offline', detail);
    for (const waiter of [...this.waiters.values()]) {
      this.finish(waiter.id, () => waiter.reject(new Error(detail)));
    }
  }

  markReady() {
    this.ready = true;
    this.publish('live', null);
    const pending = this.queue.splice(0);
    for (const request of pending) {
      if (this.waiters.has(request.id)) this.transport.send(request);
    }
  }

  receive(message: { id: string; status: number; body: string; error?: string }) {
    const waiter = this.waiters.get(message.id);
    if (!waiter) return;
    if (message.error) {
      this.finish(message.id, () => {
        this.publish('offline', message.error ?? 'Sofascore bridge failed');
        waiter.reject(new Error(message.error));
      });
      return;
    }
    if (message.status === 403 && isChallengeBody(message.body) && waiter.challengeRetries < 1) {
      waiter.challengeRetries += 1;
      this.ready = false;
      this.publish('challenge', 'Blocked 403 challenge');
      this.queue.push({ id: waiter.id, path: waiter.path });
      this.transport.reload();
      return;
    }
    if (message.status === 403 && isChallengeBody(message.body)) {
      this.finish(message.id, () => {
        this.publish('challenge', 'Blocked 403 challenge');
        waiter.reject(new Error('Sofascore refused the request (403 challenge).'));
      });
      return;
    }
    if (message.status < 200 || message.status >= 300) {
      this.finish(message.id, () => {
        const detail = `Sofascore ${message.status}`;
        this.publish(this.ready ? 'live' : 'offline', detail);
        waiter.reject(new Error(detail));
      });
      return;
    }
    this.finish(message.id, () => {
      this.publish('live', null);
      waiter.resolve({ status: message.status, body: message.body });
    });
  }

  private finish(id: string, done: () => void) {
    const waiter = this.waiters.get(id);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    this.waiters.delete(id);
    this.queue = this.queue.filter((item) => item.id !== id);
    done();
  }

  private publish(status: BridgeStatus, lastError: string | null) {
    publishBridge({ status, lastError });
  }
}

export function buildPageFetchScript(request: BridgeRequest): string {
  const id = JSON.stringify(request.id);
  const path = JSON.stringify(request.path);
  return `(function(){var id=${id};var path=${path};fetch('/api/v1'+path,{credentials:'include',headers:{Accept:'application/json'}}).then(function(res){return res.text().then(function(body){window.ReactNativeWebView.postMessage(JSON.stringify({type:'result',id:id,status:res.status,body:body}));});}).catch(function(err){window.ReactNativeWebView.postMessage(JSON.stringify({type:'result',id:id,status:0,body:'',error:String(err&&err.message||err)}));});})();true;`;
}

export function buildProbeScript(): string {
  return `(function(){fetch('/api/v1/sport/football/events/live',{credentials:'include',headers:{Accept:'application/json'}}).then(function(res){return res.text().then(function(body){window.ReactNativeWebView.postMessage(JSON.stringify({type:'probe',status:res.status,body:body.slice(0,500)}));});}).catch(function(err){window.ReactNativeWebView.postMessage(JSON.stringify({type:'probe',status:0,body:'',error:String(err&&err.message||err)}));});})();true;`;
}

export const SOFA_PAGE = 'https://www.sofascore.com/';
export const SOFA_MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
