import { execFileSync } from 'node:child_process'
import { constants, cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'

export function packInTemporaryCopy(root, prefix) {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  try {
    const source = join(scratch, 'source')
    const excluded = new Set(['.git', 'node_modules', '.local', '.superpowers', 'docs', 'test'])
    cpSync(root, source, { recursive: true, filter: path => !excluded.has(relative(root, path).split(sep)[0]) })
    // Clone existing dependencies into the fixture: resolving an external symlink
    // would expose its private absolute path in esbuild's source comments.
    if (existsSync(join(root, 'node_modules'))) cpSync(realpathSync(join(root, 'node_modules')), join(source, 'node_modules'), { recursive: true, mode: constants.COPYFILE_FICLONE })
    for (const directory of ['home', 'tmp', 'output', 'unpacked']) mkdirSync(join(scratch, directory))
    const env = {
      ...process.env,
      HOME: join(scratch, 'home'), DSH_HOME: join(scratch, 'dsh'), TMPDIR: join(scratch, 'tmp'),
      NODE_OPTIONS: undefined, DEEPSEEK_API_KEY: undefined, DEEPSEC_SCOPE_SIGNING_KEY: undefined,
      NPM_CONFIG_CACHE: join(scratch, 'npm-cache'),
      NPM_CONFIG_USERCONFIG: join(scratch, 'empty-user.npmrc'),
      NPM_CONFIG_GLOBALCONFIG: join(scratch, 'empty-global.npmrc'),
      NPM_CONFIG_OFFLINE: 'true', NPM_CONFIG_UPDATE_NOTIFIER: 'false',
      NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false', NPM_CONFIG_IGNORE_SCRIPTS: 'false',
    }
    const output = execFileSync('npm', ['pack', '--json', '--foreground-scripts=false', '--pack-destination', join(scratch, 'output')], {
      cwd: source, env, encoding: 'utf8', timeout: 30_000,
    })
    const [metadata] = JSON.parse(output)
    const archive = join(scratch, 'output', metadata.filename)
    execFileSync('tar', ['-xzf', archive, '-C', join(scratch, 'unpacked')], { env, timeout: 10_000 })
    return { scratch, env, metadata, archive, artifact: join(scratch, 'unpacked/package') }
  } catch (error) {
    rmSync(scratch, { recursive: true, force: true })
    throw error
  }
}
