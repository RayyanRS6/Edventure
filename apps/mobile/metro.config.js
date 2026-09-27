// Expo's default Metro config already understands npm workspaces: it watches the repository root and
// resolves the shared @edventure/* packages (TypeScript sources) through their workspace symlinks.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
