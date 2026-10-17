import * as nut from '@nut-tree-fork/nut-js'

console.log('typing into foreground window...')
try {
  await nut.keyboard.type('X')
  console.log('type OK')
} catch (e) {
  console.log('type FAILED:', e.message)
}
process.exit(0)
