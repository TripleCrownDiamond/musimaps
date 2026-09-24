const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all files in the monorepo so Metro picks up shared package changes
config.watchFolders = [monorepoRoot]

// RN natif demande /apps/mobile/index.bundle (chemin relatif au monorepo).
// Sans racine explicite, Metro résout l'entrée depuis projectRoot et le chemin
// devient ./apps/mobile/index → « Unable to resolve ». La racine de requête
// doit être le monorepo pour que ce chemin résolve ; watchFolders couvre tout.
config.server = { ...config.server, unstable_serverRoot: monorepoRoot }

// Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

module.exports = config
