// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileMovePointerOwner } from './file-move-pointer-owner';

describe('FileMovePointerOwner', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('retains one pointer across a stop-propagating overlay and suppresses only its release click', () => {
    const container = document.createElement('div');
    const overlay = document.createElement('button');
    document.body.append(container, overlay);
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      right: 900,
      bottom: 650,
      width: 800,
      height: 600,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });
    const captured = new Set<number>();
    container.setPointerCapture = (pointerId) => captured.add(pointerId);
    container.hasPointerCapture = (pointerId) => captured.has(pointerId);
    container.releasePointerCapture = (pointerId) => captured.delete(pointerId);
    overlay.addEventListener('pointermove', (event) => event.stopPropagation());
    overlay.addEventListener('pointerup', (event) => event.stopPropagation());
    const moves: { readonly x: number; readonly y: number }[] = [];
    const release = vi.fn(() => true);
    const cancel = vi.fn();
    const owner = new FileMovePointerOwner(container, {
      onMove: (point) => moves.push(point),
      onRelease: release,
      onCancel: cancel,
    });
    owner.attach();

    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 7,
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX: 120,
        clientY: 80,
      }),
    );
    expect(owner.claim()).toBe(true);
    expect(captured.has(7)).toBe(true);

    overlay.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 99,
        buttons: 1,
        clientX: 500,
        clientY: 300,
      }),
    );
    overlay.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        buttons: 1,
        clientX: 940,
        clientY: 710,
      }),
    );
    expect(moves).toEqual([{ x: 840, y: 660 }]);

    overlay.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        button: 0,
        buttons: 0,
      }),
    );
    expect(release).toHaveBeenCalledOnce();
    expect(cancel).not.toHaveBeenCalled();
    expect(owner.ownsPointerSequence).toBe(false);

    const activateOverlay = vi.fn();
    overlay.addEventListener('click', activateOverlay);
    overlay.click();
    expect(activateOverlay).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    overlay.click();
    expect(activateOverlay).toHaveBeenCalledOnce();

    owner.detach();
  });

  it('cancels only the matching owned pointer and removes capture on reset', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const captured = new Set<number>();
    container.setPointerCapture = (pointerId) => captured.add(pointerId);
    container.hasPointerCapture = (pointerId) => captured.has(pointerId);
    container.releasePointerCapture = (pointerId) => captured.delete(pointerId);
    const cancel = vi.fn();
    const owner = new FileMovePointerOwner(container, {
      onMove: vi.fn(),
      onRelease: vi.fn(() => false),
      onCancel: cancel,
    });
    owner.attach();
    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 11,
        button: 0,
        buttons: 1,
        isPrimary: true,
      }),
    );
    owner.claim();

    document.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: 12 }),
    );
    expect(cancel).not.toHaveBeenCalled();
    document.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: 11 }),
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(captured.size).toBe(0);

    owner.detach();
  });
});
