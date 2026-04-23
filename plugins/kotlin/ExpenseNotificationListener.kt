package com.splitit.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ExpenseNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        // Never process our own notifications to avoid feedback loops
        if (sbn.packageName == packageName) return

        val prefs = getSharedPreferences("TrackExpense", Context.MODE_PRIVATE)
        val trackRaw = prefs.getString("config", null) ?: return

        val config = try { JSONObject(trackRaw) } catch (e: Exception) { return }

        // Check expiry
        val expiresAt = config.optString("expiresAt", "")
        if (expiresAt.isNotEmpty()) {
            try {
                val expDate = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).parse(expiresAt)
                if (expDate != null && expDate.before(Date())) {
                    prefs.edit().remove("config").apply()
                    return
                }
            } catch (_: Exception) {}
        }

        val extras = sbn.notification.extras

        // Collect every text field the notification exposes — tickerText is often
        // the closest to the raw SMS body; bigText is the expanded full message.
        val ticker = sbn.notification.tickerText?.toString()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val bigTitle = extras.getCharSequence(Notification.EXTRA_TITLE_BIG)?.toString()
        val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()
        val summaryText = extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString()

        // Deduplicate and join — longer strings (bigText, ticker) go first so the
        // amount regex finds the fullest representation of the message first.
        val rawBody = listOfNotNull(ticker, bigText, text, subText, summaryText, bigTitle, title)
            .distinct()
            .joinToString(" ")
            .replace(Regex("\\s+"), " ")
            .trim()
        if (rawBody.isBlank()) return

        // Use package + notification tag/id as the "sender" to deduplicate across restores
        val sender = "${sbn.packageName}:${sbn.tag ?: ""}:${sbn.id}"
        val hash = sha256("$sender|$rawBody").take(16)

        val processedHashes = prefs.getStringSet("processedHashes", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
        if (processedHashes.contains(hash)) return

        val result = parseExpense(rawBody, sbn.packageName) ?: return

        processedHashes.add(hash)
        val trimmed = if (processedHashes.size > 500) processedHashes.toList().takeLast(500).toMutableSet() else processedHashes
        prefs.edit().putStringSet("processedHashes", trimmed).apply()

        val suggestion = JSONObject().apply {
            put("id", hash)
            put("amount", result.amount)
            put("currency", result.currency)
            put("merchant", result.merchant)
            put("date", result.date)
            put("rawSms", rawBody.take(300))
        }
        prefs.edit().putString("suggestion_$hash", suggestion.toString()).apply()

        showNotification(config, result, hash)
    }

    // ─── Notification ────────────────────────────────────────────────────────

    private fun showNotification(config: JSONObject, result: ParseResult, suggestionId: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "expense_tracking"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Expense Tracking", NotificationManager.IMPORTANCE_HIGH)
            manager.createNotificationChannel(channel)
        }

        val groupName = config.optString("groupName", "your group")
        val body = "${formatAmount(result.amount, result.currency)} at ${result.merchant} · $groupName"

        val approveIntent = Intent(this, ExpenseActionReceiver::class.java).apply {
            action = "com.splitit.APPROVE_EXPENSE"
            putExtra("suggestionId", suggestionId)
            putExtra("groupId", config.optString("groupId"))
        }
        val approvePending = PendingIntent.getBroadcast(
            this, suggestionId.hashCode() + 1, approveIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val rejectIntent = Intent(this, ExpenseActionReceiver::class.java).apply {
            action = "com.splitit.REJECT_EXPENSE"
            putExtra("suggestionId", suggestionId)
        }
        val rejectPending = PendingIntent.getBroadcast(
            this, suggestionId.hashCode() + 2, rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Expense detected")
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .addAction(0, "Approve", approvePending)
            .addAction(0, "Reject", rejectPending)
            .build()

        manager.notify(suggestionId.hashCode(), notification)
    }

    // ─── Parsing ─────────────────────────────────────────────────────────────

    data class ParseResult(val amount: Double, val currency: String, val merchant: String, val date: String)

    private fun parseExpense(body: String, sourcePackage: String): ParseResult? {
        val normalizedBody = body.replace("\n", " ").replace(Regex("\\s+"), " ").trim()

        // Exclusion patterns — skip OTPs, credits, reversals, salary, etc.
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

        // Debit / payment keyword patterns — must have at least one
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
            // German
            Regex("\\babbuchung\\b", RegexOption.IGNORE_CASE),
            Regex("\\babgebucht\\b", RegexOption.IGNORE_CASE),
            Regex("\\bkartenzahlung\\b", RegexOption.IGNORE_CASE),
            Regex("\\bumsatz\\b", RegexOption.IGNORE_CASE),
            Regex("\\bzahlung\\b", RegexOption.IGNORE_CASE),
            // French
            Regex("\\bdébité[e]?\\b", RegexOption.IGNORE_CASE),
            // Spanish/Portuguese
            Regex("\\bdébito\\b", RegexOption.IGNORE_CASE),
            // Italian
            Regex("\\baddebito\\b", RegexOption.IGNORE_CASE),
        )
        if (!debitPatterns.any { it.containsMatchIn(normalizedBody) }) return null

        var confidence = 25 // baseline: debit keyword present

        // Amount — covers all major currency symbols and codes
        // (scored before package check so we can bail early on no-amount)
        val amountRegex = Regex(
            """(?:(?:₹|RS\.?|INR|USD|\$|EUR|€|GBP|£|AED|SGD|AUD|CAD|JPY|¥|CHF|DH|DHS)\s*[\d,]+(?:\.\d{1,2})?)|(?:[\d,]+(?:\.\d{1,2})?\s*(?:₹|RS\.?|INR|USD|EUR|GBP|AED|SGD|AUD|CAD|JPY|CHF|DH|DHS))""",
            RegexOption.IGNORE_CASE
        )
        val amountMatch = amountRegex.find(normalizedBody) ?: return null
        confidence += 20

        // Package name scoring — replaces the SMS sender-ID heuristic.
        // Financial apps reliably contain these terms in their package name.
        val pkgLower = sourcePackage.lowercase(Locale.US)
        val financialTerms = listOf(
            "bank", "pay", "wallet", "upi", "money", "finance", "cash",
            "credit", "debit", "card", "invest", "trade", "loan", "insurance",
        )
        if (financialTerms.any { pkgLower.contains(it) }) confidence += 35
        else confidence += 10 // any app that posts a debit-keyword + amount notification

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

    // ─── Date parsing ─────────────────────────────────────────────────────────

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
        val formats = listOf(
            "yyyy-MM-dd", "dd/MM/yyyy", "dd/MM/yy", "dd-MM-yyyy", "dd-MM-yy",
            "dd-MMM-yyyy", "dd-MMM-yy", "dd.MM.yyyy", "dd.MM.yy", "d MMM yyyy",
        )
        for (p in patterns) {
            val m = p.find(body) ?: continue
            val value = m.groupValues[1]
            for (fmt in formats) {
                try {
                    val parser = SimpleDateFormat(fmt, Locale.US).apply { isLenient = false }
                    val d = parser.parse(value) ?: continue
                    return iso.format(d)
                } catch (_: Exception) {}
            }
        }
        return iso.format(Date())
    }

    // ─── Merchant extraction ──────────────────────────────────────────────────

    private fun extractMerchant(body: String): String {
        val stopWords = listOf(
            " on ", " ref ", " avl ", " avail ", " balance", " not you",
            " call ", " sms ", " block ", " card ", " a/c ", " acct ",
        )

        fun cleanMerchant(raw: String): String {
            var merchant = raw.trim()
            for (stop in stopWords) {
                val idx = merchant.lowercase(Locale.US).indexOf(stop)
                if (idx > 0) merchant = merchant.substring(0, idx).trim()
            }
            merchant = merchant.replace(Regex("""^[\-\s:]+|[\-\s:.,]+$"""), "").trim()
            return if (merchant.isBlank()) "Unknown" else merchant.take(40)
        }

        // UPI pattern — most reliable
        val upiMatch = Regex(
            """\bUPI-[A-Za-z0-9]+-([A-Za-z][A-Za-z0-9\s&'.,-]{1,40})""",
            RegexOption.IGNORE_CASE
        ).find(body)
        if (upiMatch != null) return cleanMerchant(upiMatch.groupValues[1])

        // Preposition-anchored patterns (order matters — more specific first)
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

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
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
        return symbol + String.format(Locale.US, "%.2f", amount)
    }
}
