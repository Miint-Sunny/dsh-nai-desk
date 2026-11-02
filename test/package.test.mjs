import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('package exposes its built host, client and preset-only tools without install hooks', () => {
  for (const name of ['.', './client', './tools', './host']) {
    const path = pkg.exports[name]
    assert.equal(typeof path, 'string', `missing ${name} export`)
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)))
  }
  for (const name of ['install', 'postinstall', 'prepare', 'prepack']) assert.equal(pkg.scripts[name], undefined)
  assert.ok(!Object.keys(pkg.dependencies ?? {}).some(name => name.startsWith('@deepseek-ai/dsh')))
})

test('distributed code has no private path, clipboard integration or random prompt action', () => {
  for (const path of ['index.js', 'host.js', 'client.js', 'tools.js']) {
    const text = readFileSync(new URL(`../lib/${path}`, import.meta.url), 'utf8')
    assert.doesNotMatch(text, /\/(?:Users|home)\/[^/\s]+|navigator\.clipboard|document\.execCommand|desk_set_draft|idea_dice/)
  }
})
