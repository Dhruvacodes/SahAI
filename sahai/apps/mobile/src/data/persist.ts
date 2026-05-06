/**
 * AsyncStorage helpers for zustand persistence.
 * Defines a custom storage adapter that zustand's `persist` middleware uses.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { type StateStorage, createJSONStorage } from "zustand/middleware";

const asyncStorageAdapter: StateStorage = {
  getItem: async (name) => {
    return (await AsyncStorage.getItem(name)) ?? null;
  },
  setItem: async (name, value) => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    await AsyncStorage.removeItem(name);
  },
};

export const persistStorage = createJSONStorage(() => asyncStorageAdapter);
