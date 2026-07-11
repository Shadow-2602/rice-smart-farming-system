import { create } from "zustand";

export const useUI = create((set) => ({
  lang: localStorage.getItem("lang") || "en",
  setLang: (lang) => {
    localStorage.setItem("lang", lang);
    set({ lang });
  },
}));
