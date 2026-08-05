import React, { createContext, useCallback, useContext, useState } from "react";
import Snackbar from "./Snackbar";

/**
 * Single, app-root-mounted toast/snackbar. Every screen/block used to render
 * its own local <Snackbar>, whose "position: absolute" overlay sizes itself
 * to its nearest parent — not the actual device screen. That happened to
 * look right for AddToCart (its parent already spans the full screen) but
 * confined the toast to that block's own bounds everywhere else (ProductGrid,
 * ProductCarousel, RecentProducts, TabProductGrid, ...), so it could show
 * mid-page instead of pinned to the bottom. Mounting one Snackbar at the App
 * root (see App.tsx) fixes the positioning for every caller at once, and
 * guarantees every toast looks and behaves identically.
 */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback(({ message, actionLabel, onAction, type = "success", duration = 2500 }) => {
    // If a toast is already showing, hide it first and show the new one on
    // the next frame — Snackbar only restarts its slide-in animation and
    // auto-dismiss timer when `visible` transitions false→true, so setting
    // new content while already visible would otherwise just swap the text
    // without resetting the timer (e.g. rapid Add to Cart taps across
    // different blocks, now that they all share this one toast).
    setVisible(false);
    requestAnimationFrame(() => {
      setToast({ message, actionLabel, onAction, type, duration });
      setVisible(true);
    });
  }, []);

  const hideToast = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <Snackbar
        visible={visible}
        message={toast?.message}
        actionLabel={toast?.actionLabel}
        onAction={toast?.onAction}
        onDismiss={hideToast}
        duration={toast?.duration ?? 2500}
        type={toast?.type ?? "success"}
      />
    </ToastContext.Provider>
  );
}

/**
 * @returns {(options: { message: string, actionLabel?: string, onAction?: () => void, type?: "success"|"error"|"info", duration?: number }) => void}
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op rather than throw — a call site rendered outside the provider
    // (shouldn't happen once mounted at the App root) should never crash
    // the screen it's on just because a toast couldn't show.
    return () => {};
  }
  return ctx;
}
