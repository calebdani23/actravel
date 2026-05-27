export const currencies = ["MXN", "USD"] as const;
export type Currency = (typeof currencies)[number];
