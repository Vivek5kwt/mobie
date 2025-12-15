declare module 'react-test-renderer';

declare global {
  function test(name: string, fn: () => void | Promise<void>): void;
}

export {};
