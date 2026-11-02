import { build } from 'esbuild'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
await mkdir(join(root, 'lib'), { recursive: true })
await build({ absWorkingDir: root, entryPoints: { index: 'src/entry.js', host: 'src/host.js', isolation: 'src/isolation.js', tools: 'src/tools-plugin.js' }, outdir: 'lib', bundle: true, platform: 'node', format: 'esm', target: 'node22', legalComments: 'linked', external: ['@deepseek-ai/schemastery'] })
// Zod's generated-validator templates contain whitespace-only lines. Normalize
// those blank lines in the build output; runtime prompt strings are untouched.
for (const name of ['index', 'host', 'isolation', 'tools']) {
  const path = join(root, `lib/${name}.js`)
  await writeFile(path, (await readFile(path, 'utf8')).replace(/\n[ \t]+\n/g, '\n\n'))
}
const result = await build({ absWorkingDir: root, entryPoints: ['src/client.jsx'], bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', external: ['react', 'react-dom', 'react/jsx-runtime'], loader: { '.css': 'text' }, write: false, legalComments: 'inline', jsx: 'automatic' })
const packageName = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).name
const wrapped = `window.__ModuleLoader__.load({id:${JSON.stringify(packageName)},factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${result.outputFiles[0].text}\nreturn module.exports;}});\n`
await writeFile(join(root, 'lib/client.js'), wrapped)
console.log('Built host, scoped tools and host-React client bundles.')
