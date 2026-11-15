import assert from 'node:assert/strict'
import { userInfo } from 'node:os'

// Inspect the complete decompressed archive, including tar and PAX headers.
export function assertNoPersonalBytes(bytes, label = 'npm archive') {
  const text = bytes.toString('utf8').toLowerCase()
  for (const forbidden of ['/users/', '/home/', 'c:\\users\\', userInfo().username.toLowerCase()]) {
    assert.equal(text.includes(forbidden), false, `${label} contains a personal home path or current account name`)
  }
}
