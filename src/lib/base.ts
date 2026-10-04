// Vite supplies a trailing slash for both root and subdirectory deployments.
export const appBase = import.meta.env.BASE_URL
export const appUrl = (path: string) => appBase + path.replace(/^\//, '')
