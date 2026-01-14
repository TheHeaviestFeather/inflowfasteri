/**
 * Vitest setup file for DOM testing
 */
import "@testing-library/jest-dom/vitest";

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = vi.fn();

// Mock ResizeObserver which is not available in jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
