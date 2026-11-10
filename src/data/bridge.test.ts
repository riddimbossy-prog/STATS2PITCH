import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SofaBridge, isChallengeBody, type BridgeRequest, type BridgeTransport } from './bridge';

function harness(timeoutMs = 200) {
  const sent: BridgeRequest[] = [];
  let reloads = 0;
  const transport: BridgeTransport = {
    send(request) {
      sent.push(request);
    },
    reload() {
      reloads += 1;
    },
  };
  return { bridge: new SofaBridge(transport, timeoutMs), sent, reloads: () => reloads };
}

test('a request waits until the page is ready, then it is sent', async () => {
  const { bridge, sent } = harness();
  const pending = bridge.enqueue('/sport/football/events/live');
  assert.equal(sent.length, 0);
  bridge.markReady();
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.path, '/sport/football/events/live');
  bridge.receive({ id: sent[0]!.id, status: 200, body: '{"events":[]}' });
  const result = await pending;
  assert.equal(result.status, 200);
  assert.equal(bridge.snapshot().status, 'live');
  assert.equal(bridge.snapshot().lastError, null);
});

test('a request times out while the page is still starting', async () => {
  const { bridge } = harness(30);
  await assert.rejects(bridge.enqueue('/sport/football/events/live'), /Couldn't load matches/);
  assert.equal(bridge.snapshot().status, 'offline');
  assert.match(bridge.snapshot().lastError ?? '', /Couldn't load matches/);
});

test('a 403 challenge reloads the page once and retries', async () => {
  const { bridge, sent, reloads } = harness();
  bridge.markReady();
  const pending = bridge.enqueue('/sport/football/events/live');
  bridge.receive({
    id: sent[0]!.id,
    status: 403,
    body: '{"error":{"code":403,"reason":"challenge"}}',
  });
  assert.equal(reloads(), 1);
  assert.equal(bridge.snapshot().status, 'challenge');
  assert.equal(bridge.snapshot().lastError, 'Blocked');
  bridge.markReady();
  assert.equal(sent.length, 2);
  assert.equal(sent[1]?.id, sent[0]?.id);
  bridge.receive({ id: sent[1]!.id, status: 200, body: '{"events":[]}' });
  const result = await pending;
  assert.equal(result.body, '{"events":[]}');
  assert.equal(bridge.snapshot().status, 'live');
});

test('a second 403 challenge rejects instead of reloading forever', async () => {
  const { bridge, sent, reloads } = harness();
  bridge.markReady();
  const pending = bridge.enqueue('/sport/football/events/live');
  const challenge = '{"error":{"code":403,"reason":"challenge"}}';
  bridge.receive({ id: sent[0]!.id, status: 403, body: challenge });
  bridge.markReady();
  bridge.receive({ id: sent[1]!.id, status: 403, body: challenge });
  await assert.rejects(pending, /Couldn't load matches/);
  assert.equal(reloads(), 1);
  assert.equal(bridge.snapshot().status, 'challenge');
});

test('challenge detection matches a blocked reason field', () => {
  assert.equal(isChallengeBody('{"error":{"code":403,"reason":"challenge"}}'), true);
  assert.equal(isChallengeBody('{"events":[]}'), false);
});
