// Minimal module shims for test-only libraries to avoid TS "cannot find module" errors
declare module "@testing-library/react";
declare module "@testing-library/jest-dom";
declare module "@testing-library/user-event";
declare module "vitest";
