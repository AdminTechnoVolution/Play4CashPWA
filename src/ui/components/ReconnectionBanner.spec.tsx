import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import ReconnectionBanner from './ReconnectionBanner';
import { useConnectionStore } from '../../store/connectionStore';

/**
 * Phase D: the banner is the only user-facing surface for socket reconnects, so the
 * acceptance criteria are explicit:
 *  - It must show ONLY after the 600 ms debounce (no flashing during normal navigation).
 *  - It must hide instantly when every socket is back to connected/disconnected.
 *  - It must respond to live store mutations (i.e. it consumes the Zustand selector,
 *    not a static snapshot).
 */
vi.mock('../../i18n/translations', () => ({
  useT: () => (key: string) => key,
}));

describe('ReconnectionBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConnectionStore.setState({ statuses: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when no socket is reconnecting', () => {
    render(<ReconnectionBanner />);
    expect(screen.queryByText('reconnection_banner_message')).toBeNull();
  });

  it('does not render before the 600 ms debounce window elapses', () => {
    useConnectionStore.setState({ statuses: { '/uno': 'reconnecting' } });
    render(<ReconnectionBanner />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText('reconnection_banner_message')).toBeNull();
  });

  it('renders after debounce when at least one socket is reconnecting', () => {
    useConnectionStore.setState({ statuses: { '/uno': 'reconnecting' } });
    render(<ReconnectionBanner />);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText('reconnection_banner_message')).toBeTruthy();
  });

  it('hides immediately when sockets recover', () => {
    useConnectionStore.setState({ statuses: { '/uno': 'reconnecting' } });
    render(<ReconnectionBanner />);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText('reconnection_banner_message')).toBeTruthy();

    act(() => {
      useConnectionStore.setState({ statuses: { '/uno': 'connected' } });
    });
    expect(screen.queryByText('reconnection_banner_message')).toBeNull();
  });
});
