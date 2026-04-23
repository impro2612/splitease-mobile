package com.splitit.app

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri

class ExpenseActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val suggestionId = intent.getStringExtra("suggestionId") ?: return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(suggestionId.hashCode())

        when (intent.action) {
            "com.splitit.APPROVE_EXPENSE" -> {
                val groupId = intent.getStringExtra("groupId") ?: return
                val deepLink = Uri.parse("splitit://confirm-expense?suggestionId=$suggestionId&groupId=$groupId")
                val launchIntent = Intent(Intent.ACTION_VIEW, deepLink).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    setPackage(context.packageName)
                }
                context.startActivity(launchIntent)
            }
            "com.splitit.REJECT_EXPENSE" -> {
                val prefs = context.getSharedPreferences("TrackExpense", Context.MODE_PRIVATE)
                prefs.edit().remove("suggestion_$suggestionId").apply()
            }
        }
    }
}
