import { useEffect, useRef } from 'react';

interface Options {
  /** px from left edge where the gesture can start (default 28) */
  edgeWidth?: number;
  /** px of horizontal drag required to dismiss (default 90) */
  threshold?: number;
  /** velocity-based dismiss: px/ms threshold during fast flicks (default 0.45) */
  velocityThreshold?: number;
  /** disable the gesture entirely */
  disabled?: boolean;
}

/**
 * Edge-swipe-to-close gesture (iOS-style).
 * Attach to the outermost element of a full-screen overlay (the element that
 * gets translated during the drag). When the user swipes from the left edge
 * past the threshold, `onClose` is called. Provides live translation + fade
 * for a native feel.
 */
export function useEdgeSwipeClose(
  elementRef: React.RefObject<HTMLElement>,
  onClose: () => void,
  options: Options = {},
) {
  const { edgeWidth = 32, threshold = 55, velocityThreshold = 0.35, disabled = false } = options;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (disabled) return;
    const el = elementRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let active = false;
    let locked: 'h' | 'v' | null = null;

    const reset = (animate: boolean) => {
      active = false;
      locked = null;
      if (animate) {
        el.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out';
        el.style.transform = '';
        el.style.opacity = '';
        // Clear inline transition after the animation so future drags update instantly.
        const onEnd = () => {
          el.style.transition = '';
          el.removeEventListener('transitionend', onEnd);
        };
        el.addEventListener('transitionend', onEnd);
      } else {
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
      }
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > edgeWidth) return;
      startX = t.clientX;
      startY = t.clientY;
      startT = Date.now();
      active = true;
      locked = null;
      el.style.transition = '';
      el.style.willChange = 'transform, opacity';
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (locked === null) {
        // Lock direction once movement passes a small deadzone
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (locked === 'v') return; // let vertical scroll work
      if (dx < 0) return; // only respond to rightward drag

      // Prevent the page underneath from horizontal scrolling during gesture
      if (e.cancelable) e.preventDefault();

      const width = window.innerWidth || 400;
      const progress = Math.min(1, dx / width);
      const opacity = 1 - progress * 0.45;
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(opacity);
    };

    const onEnd = (e: TouchEvent) => {
      if (!active) return;
      const changed = e.changedTouches[0];
      const dx = changed.clientX - startX;
      const dt = Math.max(1, Date.now() - startT);
      const v = dx / dt;
      el.style.willChange = '';
      if (locked === 'h' && (dx > threshold || v > velocityThreshold)) {
        // Animate off-screen, then close. Do NOT reset styles before unmount,
        // otherwise the underlying content shows for a frame (visual flash).
        const width = window.innerWidth || 400;
        el.style.transition = 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease-out';
        el.style.transform = `translateX(${width}px)`;
        el.style.opacity = '0';
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          el.removeEventListener('transitionend', finish);
          // Keep transform/opacity applied — the element is about to unmount.
          onCloseRef.current();
        };
        el.addEventListener('transitionend', finish);
        setTimeout(finish, 220);
      } else {
        reset(true);
      }
    };

    const onCancel = () => { if (active) reset(true); };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transition = '';
      el.style.willChange = '';
    };
  }, [elementRef, disabled, edgeWidth, threshold, velocityThreshold]);
}
