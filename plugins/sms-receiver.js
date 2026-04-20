const { withAndroidManifest } = require("@expo/config-plugins")

function addPermission(manifest, name) {
  if (!manifest["uses-permission"]) manifest["uses-permission"] = []
  if (!manifest["uses-permission"].find((p) => p.$["android:name"] === name)) {
    manifest["uses-permission"].push({ $: { "android:name": name } })
  }
}

function withSmsReceiver(config) {
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

module.exports = withSmsReceiver
