import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { packInTemporaryCopy } from './support/pack-fixture.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
function snapshot(directory) {
  if (!existsSync(directory)) return null
  const files = {}
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) visit(path)
      else files[relative(directory, path)] = createHash('sha256').update(readFileSync(path)).digest('hex')
    }
  }
  visit(directory)
  return files
}

for (const initialOutput of ['missing', 'stale']) {
  test(`packing dirty sources rebuilds ${initialOutput} output without touching the original source bytes`, () => {
    const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'nai-pack-source-')))
    let packed
    const originalLib = snapshot(join(root, 'lib'))
    try {
      const source = join(scratch, 'original')
      const excluded = new Set(['.git', 'node_modules', '.local', '.superpowers', 'docs', 'test'])
      cpSync(root, source, { recursive: true, filter: path => !excluded.has(relative(root, path).split(sep)[0]) })
      if (existsSync(join(root, 'node_modules'))) symlinkSync(realpathSync(join(root, 'node_modules')), join(source, 'node_modules'), 'dir')
      const dirtyPath = join(source, 'src/tools-plugin.js')
      writeFileSync(dirtyPath, readFileSync(dirtyPath, 'utf8') + '\nexport const packSourceSentinel = "unbuilt-local-edit"\n')
      rmSync(join(source, 'lib'), { recursive: true, force: true })
      if (initialOutput === 'stale') {
        mkdirSync(join(source, 'lib'), { recursive: true })
        for (const name of ['index', 'tools', 'client']) writeFileSync(join(source, `lib/${name}.js`), '// stale generated output\n')
      }
      const before = snapshot(source)
      packed = packInTemporaryCopy(source, 'nai-pack-isolation-')
      assert.deepEqual(snapshot(source), before, 'npm pack changed the original dirty source or generated files')
      for (const name of ['index', 'tools', 'client']) assert.ok(existsSync(join(packed.artifact, `lib/${name}.js`)), `lib/${name}.js was not rebuilt`)
      assert.match(readFileSync(join(packed.artifact, 'lib/tools.js'), 'utf8'), /unbuilt-local-edit/)
      let registration
      vm.runInNewContext(readFileSync(join(packed.artifact, 'lib/client.js'), 'utf8'), {
        window: { __ModuleLoader__: { load(value) { registration = value } } },
      })
      assert.equal(registration?.id, '@miint-sunny/dsh-nai-desk')
    } finally {
      if (packed) rmSync(packed.scratch, { recursive: true, force: true })
      rmSync(scratch, { recursive: true, force: true })
      assert.deepEqual(snapshot(join(root, 'lib')), originalLib, 'pack verification changed the worktree lib bytes')
    }
  })
}
