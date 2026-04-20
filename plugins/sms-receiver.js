const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins")
const fs = require("fs")
const path = require("path")

function addPermission(manifest, name) {
  if (!manifest["uses-permission"]) manifest["uses-permission"] = []
  if (!manifest["uses-permission"].find((p) => p.$["android:name"] === name)) {
    manifest["uses-permission"].push({ $: { "android:name": name } })
  }
}

function withSmsManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest

    addPermission(manifest, "android.permission.RECEIVE_SMS")
    addPermission(manifest, "android.permission.READ_SMS")

    const app = manifest.application[0]
    if (!app.receiver) app.receiver = []

    const receiverName = "com.splitease.app.SmsReceiver"
    const actionReceiverName = "com.splitease.app.SmsActionReceiver"

    if (!app.receiver.find((r) => r.$["android:name"] === receiverName)) {
      app.receiver.push({
        $: {
          "android:name": receiverName,
          "android:enabled": "true",
          "android:exported": "true",
          "android:permission": "android.permission.BROADCAST_SMS",
        },
        "intent-filter": [
          {
            $: { "android:priority": "999" },
            action: [{ $: { "android:name": "android.provider.Telephony.SMS_RECEIVED" } }],
          },
        ],
      })
    }

    if (!app.receiver.find((r) => r.$["android:name"] === actionReceiverName)) {
      app.receiver.push({
        $: {
          "android:name": actionReceiverName,
          "android:enabled": "true",
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "com.splitease.APPROVE_EXPENSE" } },
              { $: { "android:name": "com.splitease.REJECT_EXPENSE" } },
            ],
          },
        ],
      })
    }

    return config
  })
}

function withSmsKotlinFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const packageDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java/com/splitease/app"
      )
      fs.mkdirSync(packageDir, { recursive: true })

      const kotlinSrc = path.join(__dirname, "kotlin")
      const files = ["SmsReceiver.kt", "SmsActionReceiver.kt", "TrackExpenseModule.kt", "TrackExpensePackage.kt"]
      for (const f of files) {
        fs.copyFileSync(path.join(kotlinSrc, f), path.join(packageDir, f))
      }

      // Patch MainApplication.kt to register TrackExpensePackage
      const mainAppPath = path.join(packageDir, "MainApplication.kt")
      if (fs.existsSync(mainAppPath)) {
        let src = fs.readFileSync(mainAppPath, "utf8")
        if (!src.includes("TrackExpensePackage")) {
          src = src.replace(
            "PackageList(this).packages.apply {",
            "PackageList(this).packages.apply {\n              add(TrackExpensePackage())"
          )
          fs.writeFileSync(mainAppPath, src)
        }
      }

      return config
    },
  ])
}

module.exports = function withSmsReceiver(config) {
  config = withSmsManifest(config)
  config = withSmsKotlinFiles(config)
  return config
}
