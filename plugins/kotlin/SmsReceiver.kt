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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
            prefs.edit().putString("suggestion_$hash", suggestion.toString()).apply()

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
        val title = "Expense detected"
        val body = "${formatAmount(result.amount, result.currency)} at ${result.merchant} · $groupName"

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
        val normalizedBody = body.replace("\n", " ").replace(Regex("\\s+"), " ").trim()

        // Exclusion check
        val excludePatterns = listOf(
            Regex("\\botp\\b", RegexOption.IGNORE_CASE),
            Regex("\\bone.?time.?pass", RegexOption.IGNORE_CASE),
            Regex("\\bcredit(ed)?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bcash.?back\\b", RegexOption.IGNORE_CASE),
            Regex("\\brefund\\b", RegexOption.IGNORE_CASE),
            Regex("\\breversed?\\b", RegexOption.IGNORE_CASE),
            Regex("\\breversal\\b", RegexOption.IGNORE_CASE),
            Regex("\\bpromo\\b", RegexOption.IGNORE_CASE),
            Regex("\\breceived\\b", RegexOption.IGNORE_CASE),
            Regex("\\bdeposit(ed)?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bsalary\\b", RegexOption.IGNORE_CASE),
            Regex("\\bstatement\\b", RegexOption.IGNORE_CASE),
            Regex("\\bminimum due\\b", RegexOption.IGNORE_CASE),
            Regex("\\bdeclined\\b", RegexOption.IGNORE_CASE),
            Regex("\\bfailed\\b", RegexOption.IGNORE_CASE),
        )
        if (excludePatterns.any { it.containsMatchIn(normalizedBody) }) return null

        // Debit keyword check
        val debitPatterns = listOf(
            Regex("\\bdebited?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bpaid\\b", RegexOption.IGNORE_CASE),
            Regex("\\bpurchased?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bspent\\b", RegexOption.IGNORE_CASE),
            Regex("\\bsent\\b", RegexOption.IGNORE_CASE),
            Regex("\\bused\\b", RegexOption.IGNORE_CASE),
            Regex("\\btransfer(red)?\\b", RegexOption.IGNORE_CASE),
            Regex("\\btransaction\\b", RegexOption.IGNORE_CASE),
            Regex("\\bwithdrawn?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bcharged\\b", RegexOption.IGNORE_CASE),
            Regex("\\bpayment\\b", RegexOption.IGNORE_CASE),
            Regex("\\bupi\\b", RegexOption.IGNORE_CASE),
            Regex("\\bpos\\b", RegexOption.IGNORE_CASE),
            Regex("\\babbuchung\\b", RegexOption.IGNORE_CASE),
            Regex("\\babgebucht\\b", RegexOption.IGNORE_CASE),
            Regex("\\bkartenzahlung\\b", RegexOption.IGNORE_CASE),
            Regex("\\bumsatz\\b", RegexOption.IGNORE_CASE),
            Regex("\\bzahlung\\b", RegexOption.IGNORE_CASE),
            Regex("\\bdébité[e]?\\b", RegexOption.IGNORE_CASE),
            Regex("\\bdébito\\b", RegexOption.IGNORE_CASE),
            Regex("\\baddebito\\b", RegexOption.IGNORE_CASE),
        )
        if (!debitPatterns.any { it.containsMatchIn(normalizedBody) }) return null

        var confidence = 25 // debit keyword found

        // Amount regex
        val amountRegex = Regex(
            """(?:(?:₹|RS\.?|INR|USD|\$|EUR|€|GBP|£|AED|SGD|AUD|CAD|JPY|¥|CHF|DH|DHS)\s*[\d,]+(?:\.\d{1,2})?)|(?:[\d,]+(?:\.\d{1,2})?\s*(?:₹|RS\.?|INR|USD|EUR|GBP|AED|SGD|AUD|CAD|JPY|CHF|DH|DHS))""",
            RegexOption.IGNORE_CASE
        )
        val amountMatch = amountRegex.find(normalizedBody) ?: return null
        confidence += 20

        // Sender scoring
        if (Regex("^[A-Z]{6}\$").matches(sender)) confidence += 40
        else if (Regex("^[A-Za-z-]+\$").matches(sender)) confidence += 20

        if (Regex("\\baccount\\b", RegexOption.IGNORE_CASE).containsMatchIn(normalizedBody)) confidence += 5
        if (Regex("\\bA/c\\b", RegexOption.IGNORE_CASE).containsMatchIn(normalizedBody)) confidence += 5
        if (Regex("\\bbalance\\b", RegexOption.IGNORE_CASE).containsMatchIn(normalizedBody)) confidence += 5
        if (Regex("\\bcard\\b", RegexOption.IGNORE_CASE).containsMatchIn(normalizedBody)) confidence += 5
        if (Regex("\\bref\\b", RegexOption.IGNORE_CASE).containsMatchIn(normalizedBody)) confidence += 5
        if (Regex("\\bon\\b", RegexOption.IGNORE_CASE).containsMatchIn(normalizedBody)) confidence += 5

        if (confidence < 65) return null

        val amountStr = amountMatch.value
        val amount = amountStr.replace(Regex("[^\\d.]"), "").toDoubleOrNull() ?: return null
        if (amount <= 0) return null

        val currency = when {
            amountStr.contains("₹") || amountStr.contains("INR", true) || amountStr.contains("RS", true) -> "INR"
            amountStr.contains("EUR", true) || amountStr.contains("€") -> "EUR"
            amountStr.contains("GBP", true) || amountStr.contains("£") -> "GBP"
            amountStr.contains("AED", true) -> "AED"
            amountStr.contains("SGD", true) -> "SGD"
            amountStr.contains("AUD", true) -> "AUD"
            amountStr.contains("CAD", true) -> "CAD"
            amountStr.contains("JPY", true) || amountStr.contains("¥") -> "JPY"
            amountStr.contains("CHF", true) -> "CHF"
            amountStr.contains("DH", true) || amountStr.contains("DHS", true) -> "AED"
            amountStr.contains("$") || amountStr.contains("USD", true) -> "USD"
            else -> "USD"
        }

        val merchant = extractMerchant(normalizedBody)
        if (merchant == "Unknown" && confidence < 80) return null

        val date = parseDate(normalizedBody)

        return ParseResult(amount, currency, merchant, date)
    }

    private fun parseDate(body: String): String {
        val iso = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val patterns = listOf(
            Regex("""(\d{4}-\d{2}-\d{2})"""),
            Regex("""(\d{2}[/-]\d{2}[/-]\d{2})"""),
            Regex("""(\d{2}[/-]\d{2}[/-]\d{4})"""),
            Regex("""(\d{2}-[A-Za-z]{3}-\d{2})""", RegexOption.IGNORE_CASE),
            Regex("""(\d{2}-[A-Za-z]{3}-\d{4})""", RegexOption.IGNORE_CASE),
            Regex("""(\d{2}\.[0-9]{2}\.[0-9]{2,4})"""),
            Regex("""(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})""", RegexOption.IGNORE_CASE),
        )
        for (p in patterns) {
            val m = p.find(body) ?: continue
            try {
                val value = m.groupValues[1]
                val formats = listOf(
                    "yyyy-MM-dd",
                    "dd/MM/yyyy",
                    "dd/MM/yy",
                    "dd-MM-yyyy",
                    "dd-MM-yy",
                    "dd-MMM-yyyy",
                    "dd-MMM-yy",
                    "dd.MM.yyyy",
                    "dd.MM.yy",
                    "d MMM yyyy"
                )
                for (fmt in formats) {
                    try {
                        val parser = SimpleDateFormat(fmt, Locale.US).apply { isLenient = false }
                        val d = parser.parse(value) ?: continue
                        return iso.format(d)
                    } catch (_: Exception) {
                        // try next format
                    }
                }
            } catch (e: Exception) { /* try next */ }
        }
        return iso.format(Date())
    }

    private fun extractMerchant(body: String): String {
        val stopWords = listOf(" on ", " ref ", " avl ", " avail ", " balance", " not you", " call ", " sms ", " block ", " card ", " a/c ", " acct ")

        fun cleanMerchant(raw: String): String {
            var merchant = raw.trim()
            for (stop in stopWords) {
                val idx = merchant.lowercase(Locale.US).indexOf(stop)
                if (idx > 0) merchant = merchant.substring(0, idx).trim()
            }
            merchant = merchant.replace(Regex("""^[\-\s:]+|[\-\s:.,]+$"""), "").trim()
            return if (merchant.isBlank()) "Unknown" else merchant.take(40)
        }

        val upiMatch = Regex("""\bUPI-[A-Za-z0-9]+-([A-Za-z][A-Za-z0-9\s&'.,-]{1,40})""", RegexOption.IGNORE_CASE).find(body)
        if (upiMatch != null) {
            return cleanMerchant(upiMatch.groupValues[1])
        }

        val patterns = listOf(
            Regex("""\bto\s+([A-Za-z][A-Za-z0-9\s&'.,-]{1,60})""", RegexOption.IGNORE_CASE),
            Regex("""\bat\s+([A-Za-z][A-Za-z0-9\s&'.,-]{1,60})""", RegexOption.IGNORE_CASE),
            Regex("""\bbei\s+([A-Za-z][A-Za-z0-9\s&'.,-]{1,60})""", RegexOption.IGNORE_CASE),
            Regex("""\bfor\s+([A-Za-z][A-Za-z0-9\s&'.,-]{1,60})""", RegexOption.IGNORE_CASE),
        )

        for (pattern in patterns) {
            val match = pattern.find(body) ?: continue
            val merchant = cleanMerchant(match.groupValues[1])
            if (merchant != "Unknown" && !merchant.startsWith("INR ", true) && !merchant.startsWith("RS", true)) {
                return merchant
            }
        }

        return "Unknown"
    }

    private fun formatAmount(amount: Double, currency: String): String {
        val symbol = when (currency.uppercase(Locale.US)) {
            "INR" -> "₹"
            "USD" -> "$"
            "EUR" -> "€"
            "GBP" -> "£"
            "AED" -> "AED "
            "SGD" -> "SGD "
            "AUD" -> "AUD "
            "CAD" -> "CAD "
            "JPY" -> "¥"
            "CHF" -> "CHF "
            else -> "$"
        }
        return if (symbol.endsWith(" ")) {
            symbol + String.format(Locale.US, "%.2f", amount)
        } else {
            symbol + String.format(Locale.US, "%.2f", amount)
        }
    }
}
