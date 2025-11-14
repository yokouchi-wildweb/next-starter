"use client";

import { useEffect, useState } from "react";

import { APP_HEADER_ELEMENT_ID } from "@/constants/layout";

const FALLBACK_INTERVAL_MS = 250;

export const useHeaderHeight = (elementId: string = APP_HEADER_ELEMENT_ID) => {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let intervalId: number | null = null;
    let animationFrameId: number | null = null;
    let cleanupResizeListener: (() => void) | null = null;

    const updateHeight = (element: HTMLElement) => {
      const nextHeight = element.getBoundingClientRect().height;

      setHeight((prev) => {
        if (!Number.isFinite(nextHeight)) {
          return prev;
        }

        return Math.abs(prev - nextHeight) < 0.5 ? prev : nextHeight;
      });
    };

    const observeElement = (element: HTMLElement) => {
      updateHeight(element);

      const handleResize = () => {
        updateHeight(element);
      };

      window.addEventListener("resize", handleResize);
      cleanupResizeListener = () => {
        window.removeEventListener("resize", handleResize);
      };

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          updateHeight(element);
        });
        resizeObserver.observe(element);
        return;
      }

      intervalId = window.setInterval(() => {
        updateHeight(element);
      }, FALLBACK_INTERVAL_MS);
    };

    const ensureElement = () => {
      const element = document.getElementById(elementId);

      if (element instanceof HTMLElement) {
        observeElement(element);
        return;
      }

      animationFrameId = window.requestAnimationFrame(ensureElement);
    };

    ensureElement();

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (cleanupResizeListener) {
        cleanupResizeListener();
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [elementId]);

  return height;
};
