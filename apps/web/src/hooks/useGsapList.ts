import { useEffect, useRef } from "react";
import gsap from "gsap";

export function useGsapList<T extends HTMLElement>(animationKey: string | number) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const rows = ref.current.querySelectorAll("[data-animate-row]");
    gsap.fromTo(
      rows,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.32, stagger: 0.035, ease: "power2.out", overwrite: true },
    );
  }, [animationKey]);

  return ref;
}
