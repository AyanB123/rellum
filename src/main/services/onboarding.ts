import Store from 'electron-store'

const store = new Store<{ onboarded?: boolean }>({ name: 'rellum-state' })

export function getOnboarded(): boolean {
  return store.get('onboarded', false)
}

export function setOnboarded(value: boolean): void {
  store.set('onboarded', value)
}
