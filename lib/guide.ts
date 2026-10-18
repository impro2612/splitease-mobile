import type { Ionicons } from "@expo/vector-icons"

type IconName = keyof typeof Ionicons.glyphMap

export type GuideSection = {
  key: string
  icon: IconName
  /** Matches the feature's colour elsewhere in the app (More menu icons) */
  color: string
  title: string
  /** One line shown on the collapsed card */
  summary: string
  /** What the feature is for, in plain words */
  about: string
  steps: string[]
  tips?: string[]
  /** Where "Open" takes the user */
  route?: string
  routeLabel?: string
}

export type GuideFaq = { q: string; a: string }

/** The four things a new user needs to know, shown at the top of the guide. */
export const QUICK_START: { icon: IconName; title: string; text: string }[] = [
  { icon: "person-add-outline", title: "Add your friends", text: "Friends tab → Add. Search by name, email or phone, or sync your contacts." },
  { icon: "people-outline", title: "Create a group", text: "Groups tab → New group. One for each trip, flat or anything you share costs on." },
  { icon: "receipt-outline", title: "Add expenses", text: "Open the group → Add expense. SplitIT works out who owes whom." },
  { icon: "checkmark-done-outline", title: "Settle up", text: "When someone pays back, record it under Balances → Settle up." },
]

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    key: "home",
    icon: "home-outline",
    color: "#818cf8",
    title: "Home",
    summary: "Your overall balance and who you need to settle with",
    about: "Home is your summary across every group. It shows your net balance, how much you're owed, how much you owe, and the people you have open balances with.",
    steps: [
      "Net balance is everything added up in your default currency. Red means you owe overall, green means others owe you.",
      "\"You're owed\" and \"You owe\" split that into the two directions.",
      "Under People, each person shows what you owe them and what they owe you, and which groups it comes from.",
      "Tap a person (or their Settle up button) to jump straight to the group where that balance is.",
      "Pull down on the screen to refresh.",
    ],
    tips: [
      "Amounts in other currencies are converted with live exchange rates. If a rate can't be loaded, that amount is listed separately instead of being guessed.",
      "Tap your photo in the top-right corner to open Profile & settings.",
    ],
    route: "/(tabs)/dashboard",
    routeLabel: "Go to Home",
  },
  {
    key: "groups",
    icon: "people-outline",
    color: "#818cf8",
    title: "Groups",
    summary: "Create a group for a trip, your flat, or any shared costs",
    about: "A group is where shared expenses live. Everyone in the group sees the same expenses and balances.",
    steps: [
      "Go to the Groups tab and tap New group.",
      "Give it a name and pick an emoji and a currency (the currency most expenses will be in).",
      "Optionally add a location and trip dates — the location puts the group on your Timeline map.",
      "Add members from your friends list, then tap Create Group.",
      "Tap any group to open it. The card on the list shows whether you owe or get back money.",
    ],
    tips: [
      "Only people on your friends list can be added, so add friends first.",
      "You can change the name, emoji, currency and location later with the pencil button inside the group.",
    ],
    route: "/(tabs)/groups",
    routeLabel: "Go to Groups",
  },
  {
    key: "expenses",
    icon: "receipt-outline",
    color: "#6366f1",
    title: "Adding expenses",
    summary: "Record who paid and how to split it",
    about: "Every time someone pays for something shared, add it as an expense. SplitIT keeps a running balance for everyone.",
    steps: [
      "Open a group and tap the Add expense button at the top.",
      "Type what it was for (e.g. \"Dinner\") and the amount.",
      "Choose the currency — the group's default is selected, but you can pick any currency.",
      "Choose who paid and the date.",
      "Choose how to split it: Equally (tick who's included), By percentage, or Custom amounts for each person.",
      "Tap Save. The expense appears in the list under its date.",
    ],
    tips: [
      "Each expense shows \"you lent\" (green) or \"you borrowed\" (red) — that's what it changed for you.",
      "Tap an expense to edit or delete it.",
      "Long-press an expense to react with an emoji.",
      "No internet? The expense is saved on your phone and added automatically when you're back online.",
    ],
    route: "/(tabs)/groups",
    routeLabel: "Choose a group",
  },
  {
    key: "balances",
    icon: "swap-horizontal-outline",
    color: "#10b981",
    title: "Balances & settling up",
    summary: "See who owes whom and record payments",
    about: "The Balances tab inside a group shows every open debt — who should pay whom and how much, per currency.",
    steps: [
      "Open a group and tap the Balances tab.",
      "Find the debt that was paid and tap Settle up.",
      "Enter the amount that was actually paid — the full amount or just part of it.",
      "Tap Confirm. A full payment shows a \"Paid in full\" celebration; a part payment reduces the debt.",
      "Tap Summary on a debt to see exactly which expenses make it up.",
    ],
    tips: [
      "Recording a settlement doesn't move money — pay each other however you like (UPI, cash, bank), then record it here.",
      "A member can't be removed and a group can't be deleted while anyone still owes money in it.",
    ],
    route: "/(tabs)/groups",
    routeLabel: "Choose a group",
  },
  {
    key: "smart-debts",
    icon: "git-network-outline",
    color: "#a78bfa",
    title: "Smart Debts",
    summary: "Fewer payments to settle the whole group",
    about: "Smart Debts simplifies who pays whom so the group needs the fewest payments. Example: if A owes B ₹100 and B owes C ₹100, Smart Debts just has A pay C ₹100.",
    steps: [
      "Open a group and go to the Utility tab.",
      "Under Smart Debts, tap Enable Smart Debts and confirm.",
      "The Balances tab now shows the simplified payments.",
      "To go back to direct debts, tap Disable Smart Debts.",
    ],
    tips: [
      "Only group admins can turn Smart Debts on or off.",
      "Nobody ends up paying more or less overall — only the number of payments changes.",
    ],
  },
  {
    key: "insights-utility",
    icon: "pie-chart-outline",
    color: "#f59e0b",
    title: "Insights & Utility tabs",
    summary: "Charts, notes, statements and handy tools for a group",
    about: "Every group has an Insights tab for numbers and charts, and a Utility tab with tools.",
    steps: [
      "Insights: see the group total, your share, a spending chart (tap a slice to see it) and who paid the most.",
      "Utility → Pay next: shows who owes the most overall, so they can pay for the next shared expense.",
      "Utility → Write Notes: a shared notepad for plans, reminders or bank details.",
      "Utility → Download Statement: exports every expense as a PDF you can share.",
      "Utility also holds Smart Debts and Track Expense.",
    ],
  },
  {
    key: "members",
    icon: "person-circle-outline",
    color: "#818cf8",
    title: "Members, admins & editing a group",
    summary: "Add people, manage admins, edit or delete a group",
    about: "Group admins manage who's in the group. The person who creates a group is its first admin.",
    steps: [
      "Inside a group, tap the people icon at the top to see members. Tap it again (or Done) to go back.",
      "Tap Add members to add more friends.",
      "Admins can make another member an admin or remove a member.",
      "Tap the pencil icon to edit the group's name, emoji, currency and location.",
      "Admins can delete the whole group at the bottom of the edit screen.",
    ],
    tips: [
      "Someone who still owes or is owed money can't be removed — settle up first.",
      "A group can only be deleted once everyone is settled up. Deleting removes it for every member and can't be undone.",
    ],
  },
  {
    key: "track",
    icon: "radio-outline",
    color: "#22d3ee",
    title: "Auto expense tracking (Android)",
    summary: "Turn bank payment messages into group expenses",
    about: "While you're on a trip, SplitIT can watch for payment messages from your bank and offer to add them to a group, so you don't forget anything.",
    steps: [
      "Open the group and go to the Utility tab.",
      "Under Track Expense, tap Enable and pick an end date (or choose to stop it manually).",
      "If asked, allow SplitIT under \"Notification read, reply & control\" in your phone settings.",
      "When you pay, you'll get an \"Expense detected\" notification with the amount and place.",
      "Tap Approve to open a pre-filled expense — check it, choose how to split, and add it. Tap Reject to ignore it.",
      "A banner shows on the group while tracking is on. Tap Stop to end it early.",
    ],
    tips: [
      "Only one group can be tracked at a time.",
      "Nothing is added without your approval.",
      "Not available on iPhone — iOS doesn't let apps read payment messages.",
    ],
  },
  {
    key: "friends",
    icon: "person-add-outline",
    color: "#38bdf8",
    title: "Friends & chat",
    summary: "Add friends, invite people and chat privately",
    about: "Your friends list is who you can add to groups, record IOUs with and chat with.",
    steps: [
      "Go to the Friends tab and tap Add.",
      "Search by name, email or phone number and send a friend request.",
      "Or tap Sync Contacts to see which of your contacts are already on SplitIT — invite the rest by WhatsApp or text message.",
      "Incoming requests appear under Requests — accept or decline them there.",
      "Tap the chat icon next to a friend to message them.",
      "In a chat, long-press a message to react, copy it or delete it.",
    ],
    tips: [
      "Messages are encrypted in transit and at rest.",
      "Use the ⋮ menu next to a friend to remove or block them. Unblock people from Profile & settings → Blocked Users.",
    ],
    route: "/(tabs)/friends",
    routeLabel: "Go to Friends",
  },
  {
    key: "activity",
    icon: "pulse-outline",
    color: "#818cf8",
    title: "Activity",
    summary: "A timeline of everything that happened in your groups",
    about: "The Activity tab lists new, edited and deleted expenses, settlements, new groups, friend requests and more — grouped by day.",
    steps: [
      "Open the Activity tab.",
      "Scroll to see older events under each day's heading.",
      "Pull down to refresh.",
    ],
    route: "/(tabs)/activity",
    routeLabel: "Go to Activity",
  },
  {
    key: "spending",
    icon: "receipt-outline",
    color: "#a3e635",
    title: "My Spending",
    summary: "Understand your own spending from bank statements",
    about: "My Spending is your personal money tracker. Import a bank statement and SplitIT sorts every transaction into categories and explains where your money went. Only you can see it.",
    steps: [
      "Open More → My Spending.",
      "Tap Import statement and choose your bank statement PDF. If it's password-protected, type the password when asked.",
      "Use the arrows at the top to switch months.",
      "Overview: income, spending and savings, a category breakdown and a 6-month trend.",
      "Transactions: every entry, filterable by incoming/outgoing and category.",
      "Insights: an AI summary, small spends that add up, and categories over budget.",
    ],
    tips: [
      "Statements are read to extract transactions; your bank login is never needed.",
    ],
    route: "/(tabs)/expenses",
    routeLabel: "Open My Spending",
  },
  {
    key: "borrow-book",
    icon: "book-outline",
    color: "#f59e0b",
    title: "Borrow Book",
    summary: "Track personal loans with friends, outside of groups",
    about: "Lent someone cash or borrowed some? The Borrow Book keeps track of personal IOUs with a friend, separate from any group.",
    steps: [
      "Open More → Borrow Book and tap + (or Record an IOU).",
      "Pick the friend, choose I Lent or I Borrowed, and enter the amount, currency, date and an optional note.",
      "Tap Save IOU. The totals at the top show what friends owe you and what you owe.",
      "Tap a friend to see the full history with them.",
      "When money is paid back, tap + Part Payment for a partial amount.",
      "If you borrowed, tap Full Payment when you've paid it all — your friend gets a notification and taps ✓ Confirm Payment.",
    ],
    tips: [
      "If you lent the money, tap ✓ Mark Settled once it's all been paid back.",
      "Use + Add Amount to add more to an existing IOU.",
    ],
    route: "/borrow-book",
    routeLabel: "Open Borrow Book",
  },
  {
    key: "trip-planner",
    icon: "airplane-outline",
    color: "#10b981",
    title: "Trip Planner",
    summary: "Set a budget before you travel and track it on the way",
    about: "Plan how much you want to spend on a trip, split the budget into categories, and see how you're doing while you travel.",
    steps: [
      "Open More → Trip Planner and tap + (or Plan a trip).",
      "Pick an icon, name the trip, set the dates, total budget and currency.",
      "Optionally link a group — that group's expenses count as the trip's actual spending.",
      "Tap Create Trip, then open it.",
      "Tap a category (Stay, Food, Transport…) to set a planned amount for it.",
      "Watch Spent and Left update as the linked group adds expenses.",
    ],
    tips: [
      "Trips are sorted into Happening now, Upcoming and Past trips automatically.",
      "You can link or change the group later from the trip page.",
    ],
    route: "/trip-planner",
    routeLabel: "Open Trip Planner",
  },
  {
    key: "timeline",
    icon: "images-outline",
    color: "#a78bfa",
    title: "Timeline",
    summary: "Your trips on a world map",
    about: "Timeline puts every group that has a location on a map, so you can look back at where you've been.",
    steps: [
      "Add a location to a group when creating it, or later with the group's pencil button.",
      "Open More → Timeline to see a pin for each place.",
      "Tap a year at the top to show only that year's trips.",
      "Tap a pin to see the group name and dates. Pinch or use + / − to zoom.",
    ],
    route: "/timeline",
    routeLabel: "Open Timeline",
  },
  {
    key: "scrapbook",
    icon: "sparkles-outline",
    color: "#f43f5e",
    title: "ScrapBook",
    summary: "Your year in money, as shareable slides",
    about: "ScrapBook turns a year of shared expenses into a fun recap — your top people, places, wildest trip, biggest category and more.",
    steps: [
      "Open More → ScrapBook.",
      "Swipe left and right through the slides, or tap the dots below them.",
      "Pick another year from the buttons at the top.",
      "Tap the share button to create a PDF with every slide and send it anywhere.",
    ],
    route: "/scrapbook",
    routeLabel: "Open ScrapBook",
  },
  {
    key: "spend-diary",
    icon: "journal-outline",
    color: "#06b6d4",
    title: "Spend Diary",
    summary: "Private notes of what you spend",
    about: "A personal notebook for spending you want to keep track of — a trip, a month, a project. Nothing here is shared or split.",
    steps: [
      "Open More → Spend Diary and create a diary with a name (e.g. \"Goa Trip\").",
      "Open the diary and tap Add.",
      "Enter what it was, the amount, currency and date, then save.",
      "Tap an entry to edit it. The total at the top adds everything up per currency.",
      "Use the bin icon to delete a diary you no longer need.",
    ],
    route: "/spend-diary",
    routeLabel: "Open Spend Diary",
  },
  {
    key: "settings",
    icon: "settings-outline",
    color: "#94a3b8",
    title: "Profile & settings",
    summary: "Your account, currency, appearance and notifications",
    about: "Open More → Profile & settings (or tap your photo on Home).",
    steps: [
      "Edit Profile: change your name, photo and password.",
      "Default Currency: the currency your Home totals are shown in.",
      "Appearance: Dark, Light or follow your phone's setting.",
      "Push Notifications: turn alerts for expenses, payments, messages and requests on or off.",
      "Blocked Users: see and unblock people.",
      "Support: email the SplitIT team.",
    ],
    tips: [
      "Forgot your password? On the sign-in screen tap Forgot password? — we'll email you a code to set a new one.",
      "Delete Account is at the bottom of the page and permanently removes your data.",
    ],
    route: "/(tabs)/profile",
    routeLabel: "Open settings",
  },
  {
    key: "plus",
    icon: "sparkles-outline",
    color: "#818cf8",
    title: "SplitIT Plus",
    summary: "3 months of everything free, then splitting stays free forever",
    about: "Every new account gets the whole app free for 3 months. After that, splitting stays free forever and SplitIT Plus unlocks the rest.",
    steps: [
      "Always free: groups, unlimited expenses, balances, settle up, friends, chat and activity.",
      "With Plus: My Spending, Borrow Book, Trip Planner, Timeline, ScrapBook and Spend Diary.",
      "Plus costs ₹49 a month or ₹499 a year. Subscribe from Profile & settings → SplitIT Plus.",
      "We remind you 15 days, 7 days and 1 day before your free months end.",
    ],
    tips: [
      "Nothing is deleted when the free months end. Locked features keep your data and come back as they were when you subscribe.",
      "Without Plus, Borrow Book stays view-only: you can still see, pay and confirm IOUs your friends recorded.",
      "Changed phones? Tap Restore purchases on the Plus page.",
    ],
    route: "/plus",
    routeLabel: "See Plus",
  },
]

export const GUIDE_FAQ: GuideFaq[] = [
  {
    q: "Is SplitIT free?",
    a: "Splitting is free forever: groups, unlimited expenses, settle up, friends and chat. Everything else is free for your first 3 months, then part of SplitIT Plus (₹49 a month or ₹499 a year).",
  },
  {
    q: "Why can't I delete a group or remove a member?",
    a: "Not while money is still owed in that group — it would wipe out what people owe each other. Settle up all balances first (Balances tab → Settle up), then try again. Only admins can delete a group or remove members.",
  },
  {
    q: "Does SplitIT move money?",
    a: "No. SplitIT keeps track of who owes whom. Pay each other the way you normally do (UPI, cash, bank transfer) and record the payment with Settle up.",
  },
  {
    q: "Can I use different currencies?",
    a: "Yes. Every expense, IOU, diary entry and trip can have its own currency. Balances are kept separately per currency, and your Home totals are converted to your default currency with live exchange rates.",
  },
  {
    q: "Does it work without internet?",
    a: "You can still open the app and see what was loaded before. Group expenses you add offline are saved on your phone and sent automatically once you're back online. Most other actions need a connection.",
  },
  {
    q: "Who can see My Spending and Spend Diary?",
    a: "Only you. They're personal and never shared with friends or groups.",
  },
  {
    q: "Is auto expense tracking available on iPhone?",
    a: "No — it's Android only, because iPhones don't allow apps to read payment messages.",
  },
  {
    q: "What's the difference between a group expense and the Borrow Book?",
    a: "Group expenses are shared costs split between several people. The Borrow Book is for one-to-one loans with a single friend, like lending someone cash.",
  },
]
