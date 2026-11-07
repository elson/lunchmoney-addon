// Route ids must match manifest.json `contributes.routes[].id`; the host mounts
// them under its own namespace, /addons/<manifest.id>[/<path>].
const BASE = "/addons/lunchmoney-addon";

export const MAIN_ROUTE = { id: "lunch-money", path: BASE } as const;
export const SETTINGS_ROUTE = { id: "lunch-money-settings", path: `${BASE}/settings` } as const;
