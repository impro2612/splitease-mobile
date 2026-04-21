package com.splitease.app

import android.content.Context
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class TrackExpenseModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "TrackExpenseModule"

    private fun prefs() = reactContext.getSharedPreferences("TrackExpense", Context.MODE_PRIVATE)

    @ReactMethod
    fun setConfig(json: String, promise: Promise) {
        prefs().edit().putString("config", json).apply()
        promise.resolve(null)
    }

    @ReactMethod
    fun clearConfig(promise: Promise) {
        prefs().edit().remove("config").apply()
        promise.resolve(null)
    }

    @ReactMethod
    fun getPendingSuggestionById(id: String, promise: Promise) {
        val raw = prefs().getString("suggestion_$id", null)
        promise.resolve(raw)
    }

    @ReactMethod
    fun clearPendingSuggestionById(id: String, promise: Promise) {
        prefs().edit().remove("suggestion_$id").apply()
        promise.resolve(null)
    }

    @ReactMethod
    fun isNotificationAccessGranted(promise: Promise) {
        val packageName = reactContext.packageName
        val flat = Settings.Secure.getString(
            reactContext.contentResolver,
            "enabled_notification_listeners"
        ) ?: ""
        val granted = flat.split(":").any { it.startsWith("$packageName/") }
        promise.resolve(granted)
    }
}
