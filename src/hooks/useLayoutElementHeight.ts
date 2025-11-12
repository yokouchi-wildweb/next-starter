"use client";

import { useEffect, useState } from "react";

import { APP_FOOTER_ELEMENT_ID, APP_HEADER_ELEMENT_ID } from "@/constants/layout";

const FALLBACK_INTERVAL_MS = 250;

const useElementHeight = (elementId: string) => {
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
      const nextHeight = Math.round(element.getBoundingClientRect().height);
      setHeight((prev) => (prev === nextHeight ? prev : nextHeight));
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

export const useHeaderHeight = (elementId: string = APP_HEADER_ELEMENT_ID) =>
  useElementHeight(elementId);

export const useFooterHeight = (elementId: string = APP_FOOTER_ELEMENT_ID) =>
  useElementHeight(elementId);
