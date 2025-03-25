export function defineModule(name, handlers) {
    return {
      __nearstack: true,
      name,
      ...handlers
    };
  }