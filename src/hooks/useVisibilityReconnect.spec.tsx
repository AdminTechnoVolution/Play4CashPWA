import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { useVisibilityReconnect } from './useVisibilityReconnect';

const reconnectAllStaleSockets = vi.fn();
vi.mock('../data/network/socketRegistry', () => ({
  reconnectAllStaleSockets: (...args: unknown[]) => reconnectAllStaleSockets(...args),
}));

function Probe() {
  useVisibilityReconnect();
  return null;
}

describe('useVisibilityReconnect', () => {
  beforeEach(() => {
    reconnectAllStaleSockets.mockClear();
  });

  afterEach(() => {
    // Restore visibility to default in case a test mutated it.
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('reconnects sockets once on mount (handles "landed after sleep")', () => {
    render(<Probe />);
    expect(reconnectAllStaleSockets).toHaveBeenCalledTimes(1);
  });

  it('reconnects on visibilitychange → visible', () => {
    render(<Probe />);
    reconnectAllStaleSockets.mockClear();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(reconnectAllStaleSockets).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect when the page becomes hidden', () => {
    render(<Probe />);
    reconnectAllStaleSockets.mockClear();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(reconnectAllStaleSockets).not.toHaveBeenCalled();
  });

  it('also reconnects on window focus (Android WebView safety net)', () => {
    render(<Probe />);
    reconnectAllStaleSockets.mockClear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });

    window.dispatchEvent(new Event('focus'));
    expect(reconnectAllStaleSockets).toHaveBeenCalledTimes(1);
  });
});
