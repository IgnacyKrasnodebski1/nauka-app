// Metro dla monorepo npm workspaces.
// `expo/metro-config` sam wykrywa workspace root i dodaje oba node_modules do nodeModulesPaths.
// Dodatkowo: pakiety, które npm zagnieździł w apps/mobile/node_modules (react 19.2.x, react-native 0.86,
// reanimated…) MUSZĄ wygrać z kopiami w root (apps/web pinuje inne wersje) — inaczej w bundlu
// lądują dwa Reacty i hooki się wywalają. Stąd resolveRequest: nazwę pakietu szukamy najpierw lokalnie.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules"), path.resolve(workspaceRoot, "node_modules")];

const localNodeModules = path.resolve(projectRoot, "node_modules");
function packageNameOf(moduleName) {
  if (moduleName.startsWith(".") || moduleName.startsWith("/")) return null;
  const parts = moduleName.split("/");
  return moduleName.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}
const localPkgCache = new Map();
function hasLocalCopy(pkg) {
  if (!localPkgCache.has(pkg)) localPkgCache.set(pkg, fs.existsSync(path.join(localNodeModules, pkg, "package.json")));
  return localPkgCache.get(pkg);
}

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = packageNameOf(moduleName);
  if (pkg && hasLocalCopy(pkg) && !context.originModulePath.startsWith(localNodeModules)) {
    const ctx = { ...context, originModulePath: path.join(projectRoot, "index.js") };
    return upstreamResolve ? upstreamResolve(ctx, moduleName, platform) : context.resolveRequest(ctx, moduleName, platform);
  }
  return upstreamResolve ? upstreamResolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
