"use client";
import { site } from "@/config/site";
import { createContext, useContext } from "react";

// The menu the header draws. Without a provider, or when the admin has not edited the menu, it is `site.nav`, so
// the header is exactly what it was before the admin existed.
const HeaderMenuContext = createContext(site.nav);

export const HeaderMenuProvider = HeaderMenuContext.Provider;
export const useHeaderNav = () => useContext(HeaderMenuContext);
