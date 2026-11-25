/**
 * Cookie names for the sidebar's remembered state. Kept out of the client
 * sidebar module: a server component importing a constant from a "use client"
 * file gets a client reference, not the string.
 */
export const SIDEBAR_COOKIE = "sidebar";
export const NAV_CLOSED_COOKIE = "nav-closed";
