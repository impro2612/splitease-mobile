package com.splitease.app

import android.content.Context
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
    fun getPendingSuggestion(promise: Promise) {
        val raw = prefs().getString("pendingSuggestion", null)
        promise.resolve(raw)
    }

    @ReactMethod
    fun clearPendingSuggestion(promise: Promise) {
        prefs().edit().remove("pendingSuggestion").apply()
        promise.resolve(null)
    }
}
