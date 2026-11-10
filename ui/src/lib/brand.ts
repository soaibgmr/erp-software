// Product name and public contact, shown on the landing page, help and sign-in screens.
// Set per deployment with VITE_APP_NAME / VITE_CONTACT_EMAIL (inlined at build time).
export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined)?.trim() || "ERP Software";
export const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || null;
