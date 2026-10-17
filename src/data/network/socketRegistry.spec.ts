import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Socket } from 'socket.io-client';

// `socketAuthExpiredListener` (Phase E) is wired inside `instrumentSocket` and
// transitively imports the real ApiClient, which we don't want to boot from a
// jsdom unit test. Mocking it here also lets us isolate the registry's own
// responsibilities from the auth-refresh pathway.
vi.mock('./socketAuthExpiredListener', () => ({
  attachAuthExpiredListener: vi.fn(),
}));

import { instrumentSocket, releaseSocket, reconnectAllStaleSockets } from './socketRegistry';
import { useConnectionStore } from '../../store/connectionStore';

/**
 * Phase D: the registry is the linchpin between every SocketManager and the global
 * <ReconnectionBanner /> + useVisibilityReconnect hook. The tests below validate the
 * three observable behaviours we care about:
 *
 *  1. Status transitions in the Zustand store mirror Socket.IO lifecycle events.
 *  2. `releaseSocket` clears the namespace entry so a stale "reconnecting" toast can't
 *     linger after intentional teardown.
 *  3. `reconnectAllStaleSockets` only pokes `connect()` on sockets that are not
 *     already connected — pivotal because re-invoking connect on a healthy socket
 *     in socket.io v4 is a no-op but logs noise.
 */
type Handler = (...args: any[]) => void;

function makeFakeSocket(initiallyConnected = false) {
  const socketHandlers = new Map<string, Handler>();
  const ioHandlers = new Map<string, Handler>();
  const socket = {
    connected: initiallyConnected,
    emit: vi.fn(),
    on: vi.fn((event: string, cb: Handler) => {
      socketHandlers.set(event, cb);
    }),
    connect: vi.fn(),
    io: {
      on: vi.fn((event: string, cb: Handler) => {
        ioHandlers.set(event, cb);
      }),
    },
  } as unknown as Socket & { connected: boolean };
  return {
    socket,
    fire(event: string, ...args: unknown[]): void {
      socketHandlers.get(event)?.(...args);
    },
    fireManager(event: string, ...args: unknown[]): void {
      ioHandlers.get(event)?.(...args);
    },
  };
}

describe('socketRegistry', () => {
  beforeEach(() => {
    useConnectionStore.setState({ statuses: {} });
  });

  it('marks the namespace as connecting on registration', () => {
    const { socket } = makeFakeSocket();
    instrumentSocket(socket, '/uno');
    expect(useConnectionStore.getState().statuses['/uno']).toBe('connecting');
  });

  it('transitions to connected when the socket fires connect', () => {
    const { socket, fire } = makeFakeSocket();
    instrumentSocket(socket, '/uno');
    fire('connect');
    expect(useConnectionStore.getState().statuses['/uno']).toBe('connected');
  });

  it('treats transient disconnects as reconnecting but intentional ones as disconnected', () => {
    const { socket, fire } = makeFakeSocket();
    instrumentSocket(socket, '/uno');
    fire('disconnect', 'transport close');
    expect(useConnectionStore.getState().statuses['/uno']).toBe('reconnecting');

    fire('disconnect', 'io client disconnect');
    expect(useConnectionStore.getState().statuses['/uno']).toBe('disconnected');
  });

  it('bubbles manager-level reconnect events into the store', () => {
    const { socket, fireManager } = makeFakeSocket();
    instrumentSocket(socket, '/chess');

    fireManager('reconnect_attempt');
    expect(useConnectionStore.getState().statuses['/chess']).toBe('reconnecting');

    fireManager('reconnect');
    expect(useConnectionStore.getState().statuses['/chess']).toBe('connected');

    fireManager('reconnect_failed');
    expect(useConnectionStore.getState().statuses['/chess']).toBe('disconnected');
  });

  it('clears the namespace entry on releaseSocket so the banner stops showing it', () => {
    const { socket } = makeFakeSocket();
    instrumentSocket(socket, '/uno');
    expect(useConnectionStore.getState().statuses['/uno']).toBe('connecting');
    releaseSocket('/uno');
    expect(useConnectionStore.getState().statuses['/uno']).toBeUndefined();
  });

  it('reconnectAllStaleSockets only calls connect() on disconnected sockets', () => {
    const fakeA = makeFakeSocket(false);
    const fakeB = makeFakeSocket(true);
    instrumentSocket(fakeA.socket, '/uno');
    instrumentSocket(fakeB.socket, '/chess');

    reconnectAllStaleSockets();

    expect(fakeA.socket.connect).toHaveBeenCalledTimes(1);
    expect(fakeB.socket.connect).not.toHaveBeenCalled();
  });

  it('swallows synchronous errors from socket.connect() so a single failure does not break the sweep', () => {
    const { socket: a } = makeFakeSocket(false);
    (a.connect as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('boom');
    });
    const { socket: b } = makeFakeSocket(false);
    instrumentSocket(a, '/uno');
    instrumentSocket(b, '/chess');

    expect(() => reconnectAllStaleSockets()).not.toThrow();
    expect((b.connect as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });
});
