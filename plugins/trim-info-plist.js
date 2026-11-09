const { withInfoPlist } = require("expo/config-plugins")

/**
 * Drops permission strings for things the app never does. expo-secure-store always writes a
 * Face ID string (we never call it with requireAuthentication) and the microphone one is a
 * template default — App Review flags boilerplate strings for unused capabilities.
 */
module.exports = function withTrimmedInfoPlist(config) {
  return withInfoPlist(config, (cfg) => {
    delete cfg.modResults.NSFaceIDUsageDescription
    delete cfg.modResults.NSMicrophoneUsageDescription
    return cfg
  })
}
