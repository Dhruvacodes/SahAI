/**
 * Tiny translation hook bound to the language stored in settingsStore.
 *
 * Returns:
 *   - t(key, vars?)  → resolves a string and substitutes {placeholder} vars
 *   - lang           → currently active UI language code
 *   - setLanguage    → switch UI language
 */

import { useCallback } from "react";
import { useSettingsStore } from "../data/settingsStore";
import { getStrings, type StringKey } from "./strings";

export function useT() {
  const lang = useSettingsStore((s) => s.uiLanguage);
  const setLanguage = useSettingsStore((s) => s.setUiLanguage);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      const dict = getStrings(lang);
      let value = dict[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(new RegExp(`{${k}}`, "g"), String(v));
        }
      }
      return value;
    },
    [lang],
  );

  return { t, lang, setLanguage };
}
