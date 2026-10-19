const { withAppBuildGradle } = require("expo/config-plugins")

/**
 * Play Store signing. `./gradlew bundleRelease -PsplititUpload` signs with the upload key
 * described in ~/splitit-keys/upload.properties (kept outside the repo; override the path
 * with SPLITIT_UPLOAD_PROPERTIES). Without the flag, release builds stay debug-signed so
 * test APKs keep installing over each other on our phones.
 */
const SIGNING = `
        release {
            def propsFile = new File(System.getenv("SPLITIT_UPLOAD_PROPERTIES") ?: "\${System.getProperty('user.home')}/splitit-keys/upload.properties")
            if (propsFile.exists()) {
                def p = new Properties()
                propsFile.withInputStream { p.load(it) }
                storeFile file(p.getProperty("SPLITIT_UPLOAD_STORE_FILE"))
                storePassword p.getProperty("SPLITIT_UPLOAD_STORE_PASSWORD")
                keyAlias p.getProperty("SPLITIT_UPLOAD_KEY_ALIAS")
                keyPassword p.getProperty("SPLITIT_UPLOAD_KEY_PASSWORD")
            }
        }`

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents
    if (!g.includes("SPLITIT_UPLOAD_PROPERTIES")) {
      g = g.replace(/(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/, `$1${SIGNING}`)
      g = g.replace(
        /(release\s*\{\s*\n(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug/,
        "$1signingConfig project.hasProperty('splititUpload') ? signingConfigs.release : signingConfigs.debug",
      )
    }
    cfg.modResults.contents = g
    return cfg
  })
}
