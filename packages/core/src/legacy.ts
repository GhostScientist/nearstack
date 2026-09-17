// Legacy export from original index.js
export function defineModule(name: string, handlers: Record<string, unknown>) {
  return {
    __nearstack: true,
    name,
    ...handlers,
  };
}
