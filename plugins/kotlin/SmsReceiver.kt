package com.splitease.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.security.MessageDigest
import java.util.Date

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val prefs = context.getSharedPreferences("TrackExpense", Context.MODE_PRIVATE)
        val trackRaw = prefs.getString("config", null) ?: return

        val config = try { JSONObject(trackRaw) } catch (e: Exception) { return }

        // Check expiry
        val expiresAt = config.optString("expiresAt", "")
        if (expiresAt.isNotEmpty()) {
            try {
                val expDate = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).parse(expiresAt)
                if (expDate != null && expDate.before(Date())) {
                    prefs.edit().remove("config").apply()
                    return
                }
            } catch (e: Exception) { /* ignore parse error */ }
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        for (msg in messages) {
            val body = msg.messageBody ?: continue
            val sender = msg.originatingAddress ?: ""

            val hash = sha256(body).take(16)

            // Dedup check
            val processedHashes = prefs.getStringSet("processedHashes", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
            if (processedHashes.contains(hash)) continue

            val result = parseSms(body, sender)

            processedHashes.add(hash)
            val trimmedHashes = if (processedHashes.size > 500) processedHashes.toList().takeLast(500).toMutableSet() else processedHashes
            prefs.edit().putStringSet("processedHashes", trimmedHashes).apply()

            if (result == null) continue

            val suggestion = JSONObject().apply {
                put("id", hash)
                put("amount", result.amount)
                put("currency", result.currency)
                put("merchant", result.merchant)
                put("date", result.date)
                put("rawSms", body.take(300))
            }
            prefs.edit().putString("pendingSuggestion", suggestion.toString()).apply()

            showNotification(context, config, result, hash)
            break // one suggestion at a time
        }
    }

    private fun showNotification(context: Context, config: JSONObject, result: ParseResult, suggestionId: String) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "expense_tracking"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Expense Tracking", NotificationManager.IMPORTANCE_HIGH)
            manager.createNotificationChannel(channel)
        }

        val groupName = config.optString("groupName", "your group")
        val amountStr = "${result.currency} ${result.amount}"
        val title = "Expense detected"
        val body = "₹${result.amount} at ${result.merchant} · $groupName"

        // Approve action — opens app with deep link
        val approveIntent = Intent(context, SmsActionReceiver::class.java).apply {
            action = "com.splitease.APPROVE_EXPENSE"
            putExtra("suggestionId", suggestionId)
            putExtra("groupId", config.optString("groupId"))
        }
        val approvePending = PendingIntent.getBroadcast(
            context, 1, approveIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Reject action
        val rejectIntent = Intent(context, SmsActionReceiver::class.java).apply {
            action = "com.splitease.REJECT_EXPENSE"
            putExtra("suggestionId", suggestionId)
        }
        val rejectPending = PendingIntent.getBroadcast(
            context, 2, rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .addAction(0, "Approve", approvePending)
            .addAction(0, "Reject", rejectPending)
            .build()

        manager.notify(suggestionId.hashCode(), notification)
    }

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    data class ParseResult(val amount: Double, val currency: String, val merchant: String, val date: String)

    private fun parseSms(body: String, sender: String): ParseResult? {
        // Exclusion check
        val excludePatterns = listOf(
            Regex("\\botp\\b", RegexOption.IGNORE_CASE),
            Regex("\\bone.?time.?pass", RegexOption.IGNORE_CASE),
            Regex("\\bcredit(ed)?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bcash.?back\\b", RegexOption.IGNORE_CASE),
            Regex("\\brefund\\b", RegexOption.IGNORE_CASE),
            Regex("\\bpromo\\b", RegexOption.IGNORE_CASE),
            Regex("\\breceived\\b", RegexOption.IGNORE_CASE),
            Regex("\\bdeposit(ed)?\\b", RegexOption.IGNORE_CASE),
        )
        if (excludePatterns.any { it.containsMatchIn(body) }) return null

        // Debit keyword check
        val debitPatterns = listOf(
            Regex("\\bdebited?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bpaid\\b", RegexOption.IGNORE_CASE),
            Regex("\\bpurchased?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bspent\\b", RegexOption.IGNORE_CASE),
            Regex("\\btransaction\\b", RegexOption.IGNORE_CASE),
            Regex("\\bwithdrawn?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bcharged\\b", RegexOption.IGNORE_CASE),
            Regex("\\bpayment\\b", RegexOption.IGNORE_CASE),
            Regex("\\babbuchung\\b", RegexOption.IGNORE_CASE),
            Regex("\\bdébité[e]?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bdébito\\b", RegexOption.IGNORE_CASE),
            Regex("\\baddebito\\b", RegexOption.IGNORE_CASE),
        )
        if (!debitPatterns.any { it.containsMatchIn(body) }) return null

        var confidence = 25 // debit keyword found

        // Amount regex
        val amountRegex = Regex(
            """(?:(?:RS\.?|INR|USD|\$|EUR|€|GBP|£|AED|SGD|AUD|CAD|JPY|¥|CHF)\s*[\d,]+(?:\.\d{1,2})?)|(?:[\d,]+(?:\.\d{1,2})?\s*(?:RS\.?|INR|USD|EUR|GBP|AED|SGD|AUD|CAD|JPY|CHF))""",
            RegexOption.IGNORE_CASE
        )
        val amountMatch = amountRegex.find(body) ?: return null
        confidence += 20

        // Sender scoring
        if (Regex("^[A-Z]{6}\$").matches(sender)) confidence += 40
        else if (Regex("^[A-Za-z-]+\$").matches(sender)) confidence += 20

        if (Regex("\\baccount\\b", RegexOption.IGNORE_CASE).containsMatchIn(body)) confidence += 5
        if (Regex("\\bA/c\\b", RegexOption.IGNORE_CASE).containsMatchIn(body)) confidence += 5
        if (Regex("\\bbalance\\b", RegexOption.IGNORE_CASE).containsMatchIn(body)) confidence += 5

        if (confidence < 80) return null

        val amountStr = amountMatch.value
        val amount = amountStr.replace(Regex("[^\\d.]"), "").toDoubleOrNull() ?: return null
        if (amount <= 0) return null

        val currency = when {
            amountStr.contains("INR", true) || amountStr.contains("RS", true) -> "INR"
            amountStr.contains("EUR", true) || amountStr.contains("€") -> "EUR"
            amountStr.contains("GBP", true) || amountStr.contains("£") -> "GBP"
            amountStr.contains("AED", true) -> "AED"
            amountStr.contains("SGD", true) -> "SGD"
            else -> "USD"
        }

        val merchantRegex = Regex("""(?:\bat\s+([A-Z][A-Za-z0-9\s&'.,-]{1,40}))|(?:\bto\s+([A-Z][A-Za-z0-9\s&'.,-]{1,40}))""")
        val merchantMatch = merchantRegex.find(body)
        val merchant = (merchantMatch?.groupValues?.drop(1)?.firstOrNull { it.isNotEmpty() } ?: "Unknown").trim().take(40)

        val date = parseDate(body)

        return ParseResult(amount, currency, merchant, date)
    }

    private fun parseDate(body: String): String {
        val patterns = listOf(
            Regex("""(\d{4}-\d{2}-\d{2})"""),
            Regex("""(\d{2}[/-]\d{2}[/-]\d{4})"""),
            Regex("""(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})""", RegexOption.IGNORE_CASE),
        )
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        for (p in patterns) {
            val m = p.find(body) ?: continue
            try {
                val d = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(m.groupValues[1])
                    ?: java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale.US).parse(m.groupValues[1])
                    ?: continue
                return sdf.format(d)
            } catch (e: Exception) { /* try next */ }
        }
        return sdf.format(Date())
    }
}
