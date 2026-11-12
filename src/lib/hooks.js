import { useEffect, useState } from 'react';

const canMatch = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => (canMatch ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!canMatch) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
};

/**
 * Space taken by the on-screen keyboard and the height that is left, so fixed
 * elements can sit just above the keyboard on phones.
 */
export const useVisualViewport = (enabled) => {
  const [box, setBox] = useState({ inset: 0, height: null });
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !vv) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        setBox((prev) =>
          prev.inset === inset && prev.height === Math.round(vv.height)
            ? prev
            : { inset, height: Math.round(vv.height) }
        );
      });
    };
    measure();
    vv.addEventListener('resize', measure);
    vv.addEventListener('scroll', measure);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', measure);
      vv.removeEventListener('scroll', measure);
    };
  }, [enabled]);
  return box;
};
