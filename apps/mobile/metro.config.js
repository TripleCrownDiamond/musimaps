const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot]

// Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Ensure the shared package is resolved from the monorepo root
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => path.join(monorepoRoot, 'node_modules', String(name)),
  },
)

module.exports = config
