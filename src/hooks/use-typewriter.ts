import { useEffect, useRef, useState } from "react";

/**
 * Cycles through search terms with a type / pause / delete animation.
 * Terms are captured in a ref so passing an inline array never restarts it.
 */
export function useTypewriterPlaceholder(terms: string[]): string {
  const [text, setText] = useState("");
  const termsRef = useRef(terms);
  termsRef.current = terms;

  useEffect(() => {
    let termIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      const list = termsRef.current;
      if (!list.length) return;
      const current = list[termIndex % list.length];
      if (!deleting) {
        charIndex++;
        setText(current.slice(0, charIndex));
        if (charIndex >= current.length) {
          deleting = true;
          timeout = setTimeout(tick, 1400);
          return;
        }
        timeout = setTimeout(tick, 110);
      } else {
        charIndex--;
        setText(current.slice(0, Math.max(0, charIndex)));
        if (charIndex <= 0) {
          deleting = false;
          termIndex = (termIndex + 1) % list.length;
          timeout = setTimeout(tick, 300);
          return;
        }
        timeout = setTimeout(tick, 50);
      }
    };

    timeout = setTimeout(tick, 400);
    return () => clearTimeout(timeout);
  }, []);

  return text;
}
