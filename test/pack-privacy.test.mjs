import test from 'node:test'
import assert from 'node:assert/strict'
import { userInfo } from 'node:os'
import { assertNoPersonalBytes } from './support/pack-privacy.mjs'

const account = userInfo().username
const mixedAccount = [...account].map((letter, index) => index % 2 ? letter.toLowerCase() : letter.toUpperCase()).join('')
for (const [label, value] of [
  ['lowercase macOS home', '/users/pack-fixture'],
  ['mixed-case macOS home', '/UsErS/pack-fixture'],
  ['lowercase Linux home', '/home/pack-fixture'],
  ['mixed-case Linux home', '/HoMe/pack-fixture'],
  ['lowercase Windows home', 'c:\\users\\pack-fixture'],
  ['mixed-case Windows home', 'C:\\UsErS\\pack-fixture'],
  ['current runtime account', account],
  ['mixed-case runtime account', mixedAccount],
]) {
  test(`archive privacy rejects ${label} in decompressed tar bytes`, () => {
    // The value may be in a pathname, PAX header or file contents; all bytes count.
    const bytes = Buffer.from(`package/lib/index.js\0PaxHeader\0${value}\0export const ok = true`)
    assert.throws(() => assertNoPersonalBytes(bytes), { code: 'ERR_ASSERTION' })
  })
}

test('archive privacy accepts distributable runtime bytes', () => {
  assert.doesNotThrow(() => assertNoPersonalBytes(Buffer.from('package/lib/index.js\0export const name = "public-plugin"')))
})
