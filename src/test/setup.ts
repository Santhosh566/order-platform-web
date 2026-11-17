import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Pages are lazy-loaded; the first import of one can take a few seconds on a busy machine
configure({ asyncUtilTimeout: 5000 })

// Mantine reads these browser APIs, which jsdom does not have
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

// Mantine's autosize textarea listens for web fonts loading
if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    value: { addEventListener: () => {}, removeEventListener: () => {}, ready: Promise.resolve() },
  })
}

// Mantine's dropdowns scroll the selected option into view
Element.prototype.scrollIntoView ??= function scrollIntoView() {}
