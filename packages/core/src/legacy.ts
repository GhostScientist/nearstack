// Legacy export from original index.js
export function defineModule(name: string, handlers: any) {
  return {
    __nearstack: true,
    name,
    ...handlers,
  };
}
