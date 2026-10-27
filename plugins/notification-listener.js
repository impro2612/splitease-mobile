const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins")
const fs = require("fs")
const path = require("path")

// Native classes live in the app's own package (android.package in app.json)
const appPackage = (config) => config.android?.package ?? "com.splititapp.android"

function withNotificationListenerManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    const app = manifest.application[0]

    // ── NotificationListenerService ──────────────────────────────────────────
    if (!app.service) app.service = []
    const serviceName = `${appPackage(config)}.ExpenseNotificationListener`
    if (!app.service.find((s) => s.$["android:name"] === serviceName)) {
      app.service.push({
        $: {
          "android:name": serviceName,
          "android:label": "Expense Tracking",
          "android:permission": "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.service.notification.NotificationListenerService" } },
            ],
          },
        ],
      })
    }

    // ── Action receiver (approve / reject notification buttons) ───────────────
    if (!app.receiver) app.receiver = []
    const actionReceiverName = `${appPackage(config)}.ExpenseActionReceiver`
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
              { $: { "android:name": "com.splitit.APPROVE_EXPENSE" } },
              { $: { "android:name": "com.splitit.REJECT_EXPENSE" } },
            ],
          },
        ],
      })
    }

    return config
  })
}

function withNotificationListenerKotlinFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const pkg = appPackage(config)
      const packageDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java",
        ...pkg.split(".")
      )
      fs.mkdirSync(packageDir, { recursive: true })

      const kotlinSrc = path.join(__dirname, "kotlin")
      const files = [
        "ExpenseNotificationListener.kt",
        "ExpenseActionReceiver.kt",
        "TrackExpenseModule.kt",
        "TrackExpensePackage.kt",
      ]
      for (const f of files) {
        // Sources are written for com.splitit.app; retarget them to the real package
        const src = fs.readFileSync(path.join(kotlinSrc, f), "utf8").replace(/^package com\.splitit\.app$/m, `package ${pkg}`)
        fs.writeFileSync(path.join(packageDir, f), src)
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

module.exports = function withNotificationListener(config) {
  config = withNotificationListenerManifest(config)
  config = withNotificationListenerKotlinFiles(config)
  return config
}
