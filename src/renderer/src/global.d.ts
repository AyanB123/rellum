import type { RellumApi } from '../../preload/index'

declare global {
  interface Window {
    rellum: RellumApi
  }
}

export {}
