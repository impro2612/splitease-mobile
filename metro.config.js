const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force Metro to use pre-built CJS files for @tanstack packages instead of raw
// TypeScript source (the "react-native" field in their package.json points to
// src/index.ts, which can cause runtime errors in Hermes/old-arch).
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@tanstack/react-query") {
    return {
      filePath: path.resolve(__dirname, "node_modules/@tanstack/react-query/build/legacy/index.cjs"),
      type: "sourceFile",
    };
  }
  if (moduleName === "@tanstack/query-core") {
    return {
      filePath: path.resolve(__dirname, "node_modules/@tanstack/query-core/build/legacy/index.cjs"),
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
