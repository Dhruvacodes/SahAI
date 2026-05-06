/**
 * Settings store: ASHA worker identity, UI language, and the global consent
 * receipt hash captured at onboarding.
 *
 * Persisted to AsyncStorage so the worker only goes through onboarding once.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "./persist";

export type UiLanguage = "hi" | "en";

interface SettingsState {
  hasOnboarded: boolean;
  uiLanguage: UiLanguage;
  ashaName: string;
  ashaId: string;
  /** Hash returned from /api/consent/record at onboarding. */
  globalConsentReceiptHash?: string;
  /** Optional override of the backend URL. */
  backendUrl?: string;

  setUiLanguage: (lang: UiLanguage) => void;
  setAsha: (name: string, id: string) => void;
  setOnboarded: (value: boolean) => void;
  setConsentHash: (hash: string | undefined) => void;
  setBackendUrl: (url: string | undefined) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hasOnboarded: false,
      uiLanguage: "hi",
      ashaName: "",
      ashaId: "",
      globalConsentReceiptHash: undefined,
      backendUrl: undefined,
      setUiLanguage: (lang) => set({ uiLanguage: lang }),
      setAsha: (name, id) => set({ ashaName: name, ashaId: id }),
      setOnboarded: (value) => set({ hasOnboarded: value }),
      setConsentHash: (hash) => set({ globalConsentReceiptHash: hash }),
      setBackendUrl: (url) => set({ backendUrl: url }),
      reset: () =>
        set({
          hasOnboarded: false,
          ashaName: "",
          ashaId: "",
          globalConsentReceiptHash: undefined,
        }),
    }),
    {
      name: "sahai_settings_v1",
      storage: persistStorage,
    },
  ),
);
