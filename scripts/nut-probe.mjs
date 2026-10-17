import * as nut from '@nut-tree-fork/nut-js'

console.log('nut keys:', Object.keys(nut).slice(0, 20))
console.log('keyboard:', typeof nut.keyboard)
console.log('Key enum C:', nut.Key?.C)
try {
  await nut.keyboard.pressKey(nut.Key.LeftControl, nut.Key.C)
  await nut.keyboard.releaseKey(nut.Key.LeftControl, nut.Key.C)
  console.log('pressKey OK')
} catch (e) {
  console.log('pressKey FAILED:', e.message)
}
