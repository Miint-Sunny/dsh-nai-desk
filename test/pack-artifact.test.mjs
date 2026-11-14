import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import vm from 'node:vm'
import { parse } from 'yaml'

const root = fileURLToPath(new URL('..', import.meta.url))
const expectedName = '@miint-sunny/dsh-nai-desk'
let scratch, metadata, artifact, manifest, requireArtifact, tarBytes

before(() => {
  scratch = mkdtempSync(join(tmpdir(), 'nai-pack-'))
  const home = join(scratch, 'home'), temp = join(scratch, 'tmp')
  for (const directory of [home, temp, join(scratch, 'unpacked')]) mkdirSync(directory)
  const env = {
    ...process.env,
    HOME: home, DSH_HOME: join(scratch, 'dsh'), TMPDIR: temp,
    NODE_OPTIONS: undefined, DEEPSEEK_API_KEY: undefined, DEEPSEC_SCOPE_SIGNING_KEY: undefined,
    NPM_CONFIG_CACHE: join(scratch, 'npm-cache'),
    NPM_CONFIG_USERCONFIG: join(scratch, 'empty-user.npmrc'),
    NPM_CONFIG_GLOBALCONFIG: join(scratch, 'empty-global.npmrc'),
    NPM_CONFIG_OFFLINE: 'true', NPM_CONFIG_UPDATE_NOTIFIER: 'false',
  }
  const output = execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', scratch], {
    cwd: root, env, encoding: 'utf8', timeout: 30_000,
  })
  ;[metadata] = JSON.parse(output)
  const archive = join(scratch, metadata.filename)
  tarBytes = gunzipSync(readFileSync(archive))
  execFileSync('tar', ['-xzf', archive, '-C', join(scratch, 'unpacked')], { env, timeout: 10_000 })
  artifact = join(scratch, 'unpacked/package')
  manifest = JSON.parse(readFileSync(join(artifact, 'package.json'), 'utf8'))
  requireArtifact = createRequire(join(artifact, 'package.json'))
})
after(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }) })

test('npm pack exposes the scoped public package with its declared license', () => {
  assert.equal(metadata.name, expectedName)
  assert.equal(manifest.name, expectedName)
  assert.notEqual(manifest.private, true)
  assert.equal(manifest.license, 'GPL-3.0-only')
  assert.ok(existsSync(join(artifact, 'LICENSE')))
})

test('the unpacked package resolves its public entry and bundle patch by scoped name', () => {
  assert.equal(requireArtifact.resolve(expectedName), join(artifact, 'lib/index.js'))
  assert.equal(requireArtifact.resolve(`${expectedName}/client`), join(artifact, 'lib/client.js'))
  assert.equal(requireArtifact.resolve(`${expectedName}/cordis.patch.yml`), join(artifact, 'cordis.patch.yml'))
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
})

test('the packed client registers under the scoped loader identity', () => {
  let registration
  vm.runInNewContext(readFileSync(join(artifact, 'lib/client.js'), 'utf8'), {
    window: { __ModuleLoader__: { load(value) { registration = value } } },
  })
  assert.equal(registration?.id, expectedName)
  assert.equal(typeof registration.factory, 'function')
})

test('npm pack metadata and decompressed tar contain no personal home or account name', () => {
  const account = userInfo().username
  for (const [label, bytes] of [['metadata', Buffer.from(JSON.stringify(metadata))], ['tar', tarBytes]]) {
    assert.equal(bytes.includes(Buffer.from('/Users/')), false, `${label} contains a personal home path`)
    assert.equal(bytes.includes(Buffer.from(account)), false, `${label} contains the local account name`)
  }
})

test('the NAI archive keeps public types and copyright files without build sources or internal docs', () => {
  assert.equal(requireArtifact.resolve(`${expectedName}/tools`), join(artifact, 'lib/tools.js'))
  assert.equal(manifest.exports['./api'].types, './src/api.d.ts')
  for (const path of ['src/api.d.ts', 'NOTICE', 'VENDOR.md', 'vendor.json']) assert.ok(existsSync(join(artifact, path)), path)
  for (const { path } of metadata.files) {
    assert.match(path, /^(?:package\.json|README(?:\.en)?\.md|LICENSE|NOTICE|VENDOR\.md|vendor\.json|cordis\.patch\.yml|src\/api\.d\.ts|locale\/[^/]+\.json|skills\/.+|lib\/(?:index|client|tools)\.js(?:\.LEGAL\.txt)?)$/)
  }
})


test('packed patch resolves scoped host, tools and skill roots while keeping stable row and preset ids', () => {
  const patch = parse(readFileSync(join(artifact, 'cordis.patch.yml'), 'utf8'), {
    customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: js => ({ js }) }],
  })
  const inserted = patch.flatMap(layer => layer.insert ?? [])
  assert.deepEqual(inserted.map(row => row.id), ['nai-desk', 'preset-nai5-prompting'])
  assert.equal(inserted[0].name, expectedName)
  assert.equal(inserted[1].config.id, 'nai5-prompting')
  const rows = inserted[1].config.plugins
  assert.equal(rows.find(row => row.id === 'isolation').name, expectedName)
  assert.equal(rows.find(row => row.id === 'nai-desk-tools').name, `${expectedName}/tools`)
  const profile = join(scratch, 'profile')
  const installation = join(profile, 'node_modules', expectedName)
  mkdirSync(dirname(installation), { recursive: true })
  symlinkSync(artifact, installation, 'dir')
  const expression = rows.find(row => row.id === 'skill-filesystem').config.customSkillDirs[0].js
  const directory = new Function('baseUrl', 'process', `return (${expression})`)(pathToFileURL(`${profile}/`).href, process)
  assert.equal(directory, join(artifact, 'skills'))
})

test('packed vendored skills preserve every upstream byte and notice', () => {
  const vendor = JSON.parse(readFileSync(join(artifact, 'vendor.json'), 'utf8'))
  assert.deepEqual(readFileSync(join(artifact, 'vendor.json')), readFileSync(join(root, 'vendor.json')))
  for (const [path, digest] of Object.entries(vendor.files)) {
    assert.equal(createHash('sha256').update(readFileSync(join(artifact, path))).digest('hex'), digest, path)
  }
})
