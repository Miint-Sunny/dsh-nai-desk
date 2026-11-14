import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const expectedName = '@miint-sunny/dsh-nai-desk'

for (const initialOutput of ['missing', 'stale']) {
  test(`normal npm pack builds usable host, tools and scoped client when lib is ${initialOutput}`, async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'nai-prepack-'))
    try {
      const source = join(scratch, 'source'), output = join(scratch, 'output'), unpacked = join(scratch, 'unpacked')
      const excluded = new Set(['.git', 'node_modules', 'lib', '.local', '.superpowers'])
      cpSync(root, source, {
        recursive: true,
        filter: path => !excluded.has(relative(root, path).split(sep)[0]),
      })
      // Existing, independently cloned dependencies are read-only build inputs.
      symlinkSync(join(root, 'node_modules'), join(source, 'node_modules'), 'dir')
      for (const directory of ['home', 'tmp', 'output', 'unpacked']) mkdirSync(join(scratch, directory))
      if (initialOutput === 'stale') {
        mkdirSync(join(source, 'lib'))
        writeFileSync(join(source, 'lib/index.js'), 'export const name = "obsolete"\n')
        writeFileSync(join(source, 'lib/tools.js'), 'export const name = "obsolete-tools"\n')
        writeFileSync(join(source, 'lib/client.js'), 'window.__ModuleLoader__.load({id:"dsh-nai5-prompting"})\n')
      }
      const env = {
        ...process.env,
        HOME: join(scratch, 'home'), DSH_HOME: join(scratch, 'dsh'), TMPDIR: join(scratch, 'tmp'),
        NODE_OPTIONS: undefined, DEEPSEEK_API_KEY: undefined, DEEPSEC_SCOPE_SIGNING_KEY: undefined,
        NPM_CONFIG_CACHE: join(scratch, 'npm-cache'),
        NPM_CONFIG_USERCONFIG: join(scratch, 'empty-user.npmrc'),
        NPM_CONFIG_GLOBALCONFIG: join(scratch, 'empty-global.npmrc'),
        NPM_CONFIG_OFFLINE: 'true', NPM_CONFIG_UPDATE_NOTIFIER: 'false',
        NPM_CONFIG_IGNORE_SCRIPTS: 'false',
      }
      execFileSync('npm', ['pack', '--json', '--pack-destination', output], {
        cwd: source, env, encoding: 'utf8', timeout: 30_000,
      })
      const archives = readdirSync(output).filter(path => path.endsWith('.tgz'))
      assert.equal(archives.length, 1)
      execFileSync('tar', ['-xzf', join(output, archives[0]), '-C', unpacked], { env, timeout: 10_000 })
      const artifact = join(unpacked, 'package')
      for (const name of ['index', 'tools', 'client']) {
        assert.ok(existsSync(join(artifact, `lib/${name}.js`)), `packed lib/${name}.js is missing`)
      }
      symlinkSync(join(root, 'node_modules'), join(artifact, 'node_modules'), 'dir')
      const host = await import(pathToFileURL(join(artifact, 'lib/index.js')).href)
      assert.equal(host.name, 'nai-desk')
      assert.deepEqual(new host.Config({ mode: 'desk' }), { mode: 'desk' })
      const tools = await import(pathToFileURL(join(artifact, 'lib/tools.js')).href)
      assert.equal(typeof tools.apply, 'function')
      let registration
      vm.runInNewContext(readFileSync(join(artifact, 'lib/client.js'), 'utf8'), {
        window: { __ModuleLoader__: { load(value) { registration = value } } },
      })
      assert.equal(registration?.id, expectedName)
      assert.equal(typeof registration.factory, 'function')
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
}
