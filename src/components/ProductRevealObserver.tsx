"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = ".product-reveal";

export default function ProductRevealObserver() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".product-page");
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
    if (sections.length === 0) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return;
    }

    const initialRevealLine = window.innerHeight * 0.92;
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= initialRevealLine) {
        section.classList.add("is-visible");
      }
    });
    root.classList.add("product-reveal-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -10% 0px" }
    );

    sections.forEach((section) => {
      if (!section.classList.contains("is-visible")) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
