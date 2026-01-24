## Pocket Money Coach - 20-Day Build Plan (FINAL - Research Integrated)

**Goal:** Win $20,000 from RevenueCat Shipyard Contest (Rebecca Louise brief)  
**Deadline:** February 12, 2026 @ 11:45pm EST  
**Status:** Research complete, ready to build

---

## 🎯 Rebecca's Brief + Real User Research

### **What Rebecca Asked For (Verbatim):**
- "Huge amount of my mum followers who are **extremely short on time** or **knowledge**"
- "**Where they should shop**"
- "**How they could batch cook**"
- "**What certain meals cost to prepare versus other meals**" ← KEY FEATURE
- "Ways to **renovate your house and save money**"
- "Show them **how to invest their money**"
- "Whatever money they do have, **how to multiply** and **how to make more**"
- Target: "Mums who are **extremely busy**, **huge time restraint**, want **own financial independence**"

### **What Real Users Actually Said (From Research):**

**Shopping Pain:**
> "Aldi or Lidl? Which is actually cheaper?"
> "In Tesco thats probably about £100" (for same £58 Aldi shop)
> "The veg goes off so fast"

**Meal Prep Overwhelm:**
> "How do you find the energy 😩 i can barely get out of bed some days"
> "You did more than I do in a week"
> "My toxic trait is I'll meal prep all this and still want outside food"

**Bill Crisis:**
> "Just my electric is £110 a month. Gas is £160. PER MONTH. **It's crippling.**"
> "360 this month for my small house... it's **wrecked my budget**"

**Investing Fear:**
> "I got $8 to my name"
> "Can I start doing this with $500?" → "Not really"
> "Please how do we invest? 🥲"

**Debt Shame:**
> "No one talks about being in debt. Thank you for sharing!!!"
> "I thought my husband and I were the only ones"
> "There is definitely a lot of **shame and judgement** around credit card debt"
> "**It feels so lonely** to have these hardships"

**Universal Cry:**
> "**You are not alone**" (repeated in every thread)

---

## 🏆 Win Strategy

**Judging Criteria Weights:**
- 30% Audience Fit ← We dominate this (using their exact words)
- 25% User Experience ← Simple, survival-focused design
- 20% Monetization ← Clear RevenueCat integration
- 15% Innovation ← Empathetic tone + survival focus
- 10% Technical Quality ← Solid execution

**Our Competitive Advantage:**
Most devs will build generic budget trackers with preachy "just save more" tone. We're building using **real user language** with **zero shame**, solving **actual problems** documented in research.

**Target Score: 44/50 (88%) = Top 3%**

---

## 🛠️ Shipping Container Tools

| Tool | Status | Use Case | When |
|------|--------|----------|------|
| **Expo** (1mo Starter) | ✅ Claimed | EAS Build, push notifications, OTA updates | Days 1-20 (PRIMARY) |
| **Mobbin** (3mo Pro) | ✅ Claimed | UI/UX pattern research, finance app designs | Days 2, 13 (HIGH) |
| **Fastshot** (1mo Pro) | ✅ Claimed | Demo video recording + editing | Day 19 (CRITICAL) |
| **Replit** (1mo Core) | ✅ Claimed | Content formatting scripts, bulk import | Days 9-12 (MEDIUM) |
| **Vibecode** (1mo free) | ✅ Claimed | Check for component templates (30min max) | Day 3 |
| **Rork** (99% off) | ✅ Claimed | Investigate usefulness (10min max) | Day 2 |
| **Paddle** ($100K free) | ✅ Claimed | Not needed for mobile (RevenueCat handles it) | Post-contest |

**Free Tools:**
- RevenueCat SDK (required, free tier)
- Airtable (content CMS, free tier)
- React Native Paper (UI components)
- Canva (thumbnails/graphics)

---

## 📅 20-Day Build Timeline

### **PHASE 1: Foundation (Days 1-2)**

**Day 1: Research Integration & Setup**

**Morning (3 hours):**
- [x] Rebecca's brief analyzed
- [x] User research completed (TikTok, Facebook groups)
- [ ] Create "User Quotes" doc with top 20 quotes
- [ ] Initialize Expo: `npx create-expo-app pocket-money-coach`
- [ ] Install dependencies:
  - `npx expo install react-native-paper`
  - `npx expo install @react-navigation/native`
  - `npx expo install @react-navigation/bottom-tabs`
- [ ] Set up Airtable account + create Tips table
- [ ] Mobbin research: Search "personal finance", "budget app", "onboarding"

**Afternoon (4 hours):**
- [ ] Sketch two-part navigation (Save Today / Build Tomorrow)
- [ ] Paper wireframes: Home, onboarding, tip detail, meal calculator, shop comparison
- [ ] Take photos of sketches, organize in project folder
- [ ] Set up navigation structure (Bottom tabs for two sections)
- [ ] Create Airtable schema (see Data Structure section)
- [ ] Define clear monetization tiers

**Evening (Optional - 1 hour):**
- [ ] Write first 5 tips using REAL USER LANGUAGE
- [ ] Add to Airtable with user quotes that inspired them
- [ ] Test Airtable API connection

**Deliverable:** Project structure ready, user research documented, tone guide created

---

**Day 2: Core Structure & Tone Foundation**

**Morning (3 hours):**
- [ ] Create `constants/copy.js` with empathetic messaging:
  ```javascript
  export const COPY = {
    onboarding: {
      welcome: "Life is hard. Money is harder. Let's make it easier together.",
      notAlone: "You're not alone in this. Thousands of mums are walking this path with you."
    },
    emptyStates: {
      noTips: "Let's start small. Every journey begins with one tip.",
      noSavings: "You're surviving. That's enough for today. Let's build tomorrow together."
    }
  };
  ```
- [ ] Set up Airtable with updated schema (includes `user_quote` field)
- [ ] Build basic navigation shell
- [ ] Test Expo Go on physical device

**Afternoon (3 hours):**
- [ ] Design color palette (warm, trustworthy, NOT corporate):
  - Primary: Soft teal (#4A9B9B) - calm, trustworthy
  - Secondary: Warm coral (#FF9F80) - friendly, encouraging
  - Background: Off-white (#F9F7F4)
  - Text: Charcoal (#2D3436)
- [ ] Create reusable components:
  - `TipCard.js` (with empathetic design)
  - `SavingsTracker.js`
  - `Button.js` (warm, friendly)
- [ ] Set up basic typography (readable, not clinical)

**Evening (1 hour):**
- [ ] Explore Vibecode templates (30min max)
- [ ] Check Rork usefulness (10min max)
- [ ] Document any useful findings

**Deliverable:** Navigation working, tone established, design system created

---

### **PHASE 2: Core MVP (Days 3-8)**

**Day 3: Onboarding Flow**

- [ ] **Welcome screen:**
  - "Welcome to Pocket Money Coach"
  - "Life is hard. Money is harder. Let's make it easier."
  - Beautiful illustration (Undraw)
  
- [ ] **3-Question Onboarding:**
  - Q1: "How many kids?" (1, 2, 3+, None)
  - Q2: "What's your biggest money worry?"
    - Options: "Bills are crushing me", "Can't save anything", "Don't know where to start investing", "Debt feels impossible", "Just surviving day-to-day"
  - Q3: "How much time do you have daily?"
    - Options: "5 minutes (I'm exhausted)", "15 minutes", "30+ minutes on weekends"

- [ ] Save responses to AsyncStorage
- [ ] Tutorial (3 swipe cards):
  - "Small wins matter"
  - "You're not alone - thousands of mums are here with you"
  - "This is survival, not failure"

**Deliverable:** Empathetic onboarding complete

---

**Days 4-5: Home Screen - Two Sections**

**Section 1: Save Today (Survival Focus)**
- [ ] Today's daily tip card (large, prominent)
- [ ] "Saved this month: £XXX" tracker
- [ ] Quick action buttons:
  - Where to Shop
  - Meal Costs
  - Bills Crisis
  - DIY Savings
- [ ] Empathetic messaging: "Every £1 saved is a win"

**Section 2: Build Tomorrow (Hope Focus)**
- [ ] Investing tip of the day
- [ ] "Wealth built: £XXX" (cumulative from £5/week investing)
- [ ] Quick action buttons:
  - Start with £5
  - ISAs Explained
  - Debt Support
- [ ] Hopeful messaging: "Financial independence starts with £5"

**Tip Detail Screen (Same for Both Sections):**
- [ ] Title (using user language)
- [ ] User quote that inspired it (in italics, empathy builder)
- [ ] Description (friendly, not preachy)
- [ ] How-to steps (clear, numbered)
- [ ] Time required (realistic)
- [ ] Savings amount (specific: "£312/year" not "lots")
- [ ] "Mark as done" button with celebration
- [ ] "Share this win" button

**Deliverable:** Home screen working, tip details displaying from Airtable

---

**Days 6-7: Six Main Categories**

**Save Today Categories:**

1. [ ] **Where to Shop** (15 tips)
   - Aldi vs Tesco vs Lidl comparisons
   - Brand swaps with exact savings
   - Yellow sticker timing
   - "Veg goes off fast" solutions

2. [ ] **Meal Costs & Batch Cooking** (15 tips)
   - "£58 Aldi shop = 7 days meals breakdown"
   - Cost-per-serving calculator
   - Lazy meal prep (30min max)
   - "Can barely get out of bed" tier recipes

3. [ ] **Bills Crisis** (15 tips)
   - Energy bill negotiation scripts
   - "Bills are crippling" emergency plan
   - Bank charge elimination
   - Subscription audits

**Build Tomorrow Categories:**

4. [ ] **DIY & Home** (10 tips)
   - Paint vs decorator savings
   - Small DIY wins (not massive renovations)
   - Furniture upcycling
   - Budget room refreshes

5. [ ] **Start Investing** (15 tips)
   - "£5/week → £8K in 20 years"
   - ISAs explained (no jargon)
   - "I have £8 to my name" starting guide
   - Compound interest visual calculator

6. [ ] **Debt Support** (NEW - 10 tips)
   - "You're not alone in debt"
   - Debt avalanche vs snowball
   - Shame-free progress tracking
   - Mental health + debt resources

**Features:**
- [ ] List views with filters (by time: 5min, 15min, weekend)
- [ ] Search functionality
- [ ] Tag system for urgency (Crisis, Quick Win, Long-term)
- [ ] Save favorites

**Deliverable:** All 6 categories browsable, 80 tips ready (detailed on Days 9-12)

---

**Day 8: Interactive Tools**

**1. Savings Tracker**
- [ ] Log daily wins (any amount counts)
- [ ] Monthly/yearly totals with graphs
- [ ] Celebration animations at milestones (£10, £50, £100)
- [ ] Empathetic messaging: "You saved £5 this week. That's £260/year. You're doing it."

**2. Meal Cost Calculator** ← Rebecca specifically requested
- [ ] Input ingredients with prices
- [ ] Calculate cost per serving
- [ ] Compare to takeaway price
- [ ] Show annual savings if repeated weekly
- [ ] Share results feature

**3. Shop Comparison Tool**
- [ ] Quick compare: Aldi vs Tesco vs Lidl
- [ ] Common items price database
- [ ] Weekly shop estimate
- [ ] "Switch and save £XXX/year"

**4. Bills Tracker**
- [ ] Log monthly bills
- [ ] Highlight "call to negotiate" opportunities
- [ ] Track reductions after negotiations
- [ ] Celebrate wins

**Deliverable:** All interactive tools working, tested on real scenarios

---

### **PHASE 3: Content Creation (Days 9-12)**

**Content Quality Standards (Every Tip MUST Have):**
- ✅ **Specific** ("Aldi Mamia nappies" not "cheaper nappies")
- ✅ **Quantified** ("£312/year saved" not "save money")
- ✅ **Empathetic** (acknowledge it's hard, no shame)
- ✅ **Actionable** (exact steps, realistic time)
- ✅ **User-inspired** (include quote that inspired it)

---

**Day 9: Where to Shop (15 tips)**

**Use research quotes to guide tone:**
> "Aldi or Lidl? Which is actually cheaper?"
> "The veg goes off so fast"

**Examples:**
1. "Aldi vs Tesco: Same Shop, £42/Week Saved (£2,184/Year)"
2. "Lidl vs Aldi: Actual Price Comparison for Family of 3"
3. "Why Aldi Veg Goes Off Fast + How to Fix It"
4. "Tesco Clubcard Math: £180/Year for Family of 4"
5. "Yellow Sticker Strategy: £40/Week Reduced Items"
6. "Aldi Mamia Nappies vs Pampers: £312/Year Saved"
7. "Store Brand vs Branded: 20 Swaps That Taste Identical"
8. "Shopping on £30/Week: Exact Aldi List"
9. "Bulk Buying ROI: What's Worth It, What's Not"
10. "Online vs In-Store: Hidden Costs Comparison"
11. "Iceland Frozen Saves £25/Week vs Fresh (Quality Same)"
12. "Waitrose Essentials = Tesco Quality at Aldi Price"
13. "Weekly Shop Timing: Best Days to Save"
14. "Loyalty Card Stacking: Combine for Max Savings"
15. "Shop Local Markets: £15/Week Saved on Produce"

---

**Day 10: Meal Costs & Batch Cooking (15 tips)**

**Use research quotes:**
> "How do you find the energy 😩 i can barely get out of bed some days"
> "That would be around $300 here in California"

**Examples:**
1. "£58 Aldi Shop = 7 Days of Meals (Exact Breakdown)"
2. "Homemade Lasagna: £8 Feeds 6 vs Takeaway: £48"
3. "Lazy Meal Prep: 5 Freezer Meals in 30 Minutes"
4. "Sunday Slow Cooker Chicken: £12 = 8 Meals vs £64 Takeaway"
5. "Can Barely Get Out of Bed? 15-Minute Dump Meals"
6. "Batch Bolognese: £1.20/Serving in 2 Hours"
7. "Overnight Oats × 5: £12 Week vs £35 Meal Deals"
8. "Toddler Meals: 12 Portions for £8 (Freeze & Forget)"
9. "Cost Per Serving Calculator: Real Examples"
10. "Meal Prep Anti-Temptation Hacks (Stop Ordering Out)"
11. "One-Pot Wonders: £6 Feeds 4, 20 Minutes"
12. "Freezer Breakfast Burritos: £0.80 Each vs £3.50 Shop"
13. "Pasta Sauce from Scratch: £1.50 vs £3.50 Jar (Tastes Better)"
14. "Budget Meal Planning: £50/Week for Family of 4"
15. "Leftover Transformation: One Chicken = 3 Meals"

---

**Day 11: Bills Crisis & Debt Support (25 tips total)**

**Bills Crisis (15 tips) - Use research:**
> "Just my electric is £110 a month. Gas is £160. PER MONTH. It's crippling."
> "it's wrecked my budget"

**Examples:**
1. "Bills Are Crippling: Emergency Reduction Plan (Start Today)"
2. "Energy Bill £120→£240: What to Do RIGHT NOW"
3. "Call Your Energy Supplier Script: Save £300/Year in 10 Min"
4. "Switching Energy: Step-by-Step (£200-£400 Saved)"
5. "Car Insurance Phone Call: 5 Minutes = £150/Year Saved"
6. "Bank Charges Eating Savings? Switch to Starling/Monzo (£0 Fees)"
7. "Council Tax Reduction: Check If You Qualify (25% Off)"
8. "Water Bill Direct Debit: £8/Month Saved"
9. "TV License: Do You Actually Need It? Alternatives"
10. "Subscription Audit: Find £40/Month Hidden Costs"
11. "Broadband Negotiation Script: £15/Month Saved"
12. "Mobile Phone: £10 SIM vs £45 Contract (Same Service)"
13. "Budget When Paid Daily/Weekly: Envelope Method"
14. "Emergency Bill Fund: Start with £5/Week"
15. "Bills Tracker: Negotiate Every 12 Months"

**Debt Support (10 tips) - Use research:**
> "No one talks about being in debt. Thank you for sharing!!!"
> "It feels so lonely"

**Examples:**
1. "£7K Debt? You're Not Alone (Real Stories)"
2. "Debt Happened Because You Survived, Not Because You Failed"
3. "Avalanche vs Snowball: Which Debt Method Works"
4. "Mental Health + Debt: How to Cope (Resources)"
5. "Shame-Free Debt Tracker: Celebrate Every £10 Paid"
6. "Debt Consolidation: Is It Right for You?"
7. "Emergency Savings While in Debt: £50 Buffer Fund"
8. "Debt Payoff Calculator: Your Freedom Date"
9. "Telling Partner About Debt: Communication Guide"
10. "Bankruptcy UK: When It's an Option (No Judgment)"

---

**Day 12: DIY, Home & Investing (25 tips total)**

**DIY & Home (10 tips):**
1. "Paint Your Bedroom: £60 DIY vs £400 Decorator"
2. "Fix Running Toilet: £2 Washer vs £80 Plumber (20 Min)"
3. "IKEA Hack: £50 Dresser Looks £300 with Paint"
4. "Garden Makeover: £100 DIY vs £600 Landscaper"
5. "Homemade Cleaning Spray: £0.20 vs £3.50 Method"
6. "Budget Bathroom Refresh: £150 vs £2K Renovation"
7. "Furniture Upcycling: Facebook Marketplace £20 Finds"
8. "Kitchen Cabinet Painting: £200 vs £3K Replacement"
9. "YouTube DIY: Best Channels for Home Repairs"
10. "When to DIY vs When to Hire (Decision Matrix)"

**Start Investing (15 tips) - Use research:**
> "I got $8 to my name"
> "Please how do we invest? 🥲"

**Examples:**
1. "Start Investing with £5/Week (Yes, Really)"
2. "£10/Week in Vanguard FTSE = £10,400 in 10 Years"
3. "ISAs Explained for People Who Feel Dumb About Money"
4. "I Have £8 to My Name: Here's How to Start Anyway"
5. "Open Your First ISA in 10 Minutes (Step-by-Step)"
6. "Index Funds: 'Owning a Bit of Every Company' Explained"
7. "Compound Interest Visual: Why £5 Today = £20 Later"
8. "Investing on 30K Salary: It's Possible"
9. "Emergency Fund First or Invest? (Honest Answer)"
10. "Vanguard vs Fidelity vs Hargreaves Lansdown (UK Comparison)"
11. "£50/Week → £500K at 55 (Financial Independence Math)"
12. "What If Stock Market Crashes? (Your £5 is Safe)"
13. "Side Hustle for Mums: 5 Ideas That Actually Work"
14. "Passive Income Basics: What It Really Means"
15. "Financial Independence Roadmap for Single Mums"

**Use Replit:** Create scripts to format all 80 tips consistently for Airtable bulk import

**Deliverable:** 80 high-quality, empathetic, user-language tips loaded in Airtable

---

### **PHASE 4: Monetization (Days 13-15)**

**Day 13: RevenueCat Setup**

**Morning (2 hours):**
- [ ] Create RevenueCat account (free)
- [ ] Add app in dashboard
- [ ] Configure products:
  - **Pro**: £4.99/month
- [ ] Set up entitlements: `pro_access`
- [ ] Get API keys (public for app)

**Afternoon (4 hours):**
- [ ] Install SDK: `npx expo install react-native-purchases`
- [ ] Initialize in `App.js`:
  ```javascript
  import Purchases from 'react-native-purchases';
  
  await Purchases.configure({
    apiKey: 'your_public_api_key'
  });
  ```
- [ ] Create subscription checking function
- [ ] Test connection

**Evening (2 hours):**
- [ ] Create paywall screen (use RevenueCat Paywalls UI)
- [ ] Design benefits screen
- [ ] Test in sandbox mode

**Deliverable:** RevenueCat connected, products configured

---

**Day 14: Purchase Flow & Free/Pro Tiers**

**Free Tier:**
- 4 daily tips (3 Save Today + 1 Build Tomorrow)
- Basic savings tracker
- Basic meal cost calculator (3 calculations/day)
- Limited shop comparison (5 items)
- View all tip titles (locked content shows)

**Pro Tier (£4.99/month):**
- Unlimited all tips (80+)
- Full meal cost calculator (unlimited)
- Complete shop comparison tool
- Full bills tracker
- ALL DIY guides
- **Complete investing education** (high perceived value)
- ALL debt support content
- Personalized recommendations (based on onboarding)
- Weekly money-saving challenges
- Monthly financial health report
- No ads
- Priority support

**Value Proposition:**
> "£4.99/month = 1 coffee. But ONE tip saves £100+. And investing education can build £10K+. You're not spending £4.99 — you're investing in £thousands saved."

**Implementation:**
- [ ] Implement purchase flow: `Purchases.purchasePackage()`
- [ ] Lock premium tips behind subscription check
- [ ] Handle subscription states (active/expired/trial)
- [ ] Restore purchases functionality
- [ ] Test all flows in sandbox
- [ ] Error handling (graceful failures)

**Paywall Design:**
- [ ] Beautiful, not pushy
- [ ] Testimonial quotes from beta users (if available)
- [ ] "Start 7-day free trial" button
- [ ] Clear benefits list
- [ ] "You're worth it" empathetic messaging

**Deliverable:** Full monetization working, tested thoroughly

---

**Day 15: Polish & Notifications**

**Morning (3 hours) - Push Notifications:**
- [ ] Set up Expo Notifications
- [ ] Daily tip notification (7:00 AM - "Morning! Here's today's money win")
- [ ] Weekly savings summary (Sunday 6:00 PM)
- [ ] Bill reminder (1st of month - "Time to check bills for negotiation")
- [ ] Investing reminder (Fridays - "Payday? Don't forget your £5 investing")
- [ ] Milestone celebrations (in-app + push)
- [ ] Allow users to customize notification times
- [ ] Test all notification flows

**Afternoon (5 hours) - UI Polish:**
- [ ] Illustrations for each category (Undraw or custom)
- [ ] Consistent color palette application
- [ ] Loading states (friendly messages, not spinners only)
  - "Finding your best tips..."
  - "Calculating your savings..."
- [ ] Error states (empathetic, not scary)
  - "Oops! Can't load tips right now. Your saved tips are still here though!"
- [ ] Empty states (encouraging, not judgy)
  - "No tips saved yet? That's okay! Start exploring and find your first win."
  - "Your savings tracker is empty. That's fine - we all start somewhere. Let's begin!"
- [ ] Micro-interactions (smooth transitions, haptic feedback)
- [ ] Accessibility (text scaling, screen reader support, color contrast)
- [ ] Dark mode consideration (optional, but nice)

**Deliverable:** Polished, production-ready app with notifications

---

### **PHASE 5: Testing & Deploy (Days 16-18)**

**Day 16: TestFlight Build**

**Morning (3 hours):**
- [ ] Configure `app.json` for production
- [ ] Create app icons (1024×1024 base, Expo auto-generates sizes)
- [ ] Create splash screen
- [ ] Set version number (1.0.0)
- [ ] Build with EAS: `eas build --platform ios`
- [ ] Wait for build (can take 20-30 min)

**Afternoon (3 hours):**
- [ ] Set up App Store Connect account
- [ ] Create app listing (don't publish, just setup)
- [ ] Upload build to TestFlight
- [ ] Add yourself as internal tester
- [ ] Test on physical device (iPhone)

**Evening (2 hours):**
- [ ] Go through entire user journey on device
- [ ] Test all features
- [ ] Fix critical bugs
- [ ] Create bug list (prioritize)

**Deliverable:** Working TestFlight build, tested on device

---

**Day 17: Beta Testing**

**Morning (2 hours):**
- [ ] Recruit 5-10 beta testers:
  - Twitter: "Looking for mums to test my money-saving app. DM if interested!"
  - Reddit: r/UKPersonalFinance, r/MoneySavingUK
  - Facebook: Budget Mum groups
- [ ] Send TestFlight invites
- [ ] Create feedback form (Google Forms):
  - Is the content actually helpful?
  - Any confusing parts?
  - Would you pay £4.99/month for Pro?
  - What's missing?
  - Overall feeling (empowered? judged? confused?)

**Afternoon (3 hours):**
- [ ] Monitor feedback as it comes in
- [ ] Respond to testers (thank them!)
- [ ] Document all issues
- [ ] Prioritize: Critical (must fix) / Nice to have (later)

**Evening (3 hours):**
- [ ] Fix top 3 critical issues
- [ ] Push OTA update if needed (Expo magic!)
- [ ] Re-test fixes

**Deliverable:** User-validated app, critical issues fixed

---

**Day 18: Final Polish & Performance**

**Morning (3 hours):**
- [ ] Address remaining critical feedback
- [ ] Performance optimization:
  - Image compression
  - Lazy loading for tip lists
  - Airtable caching (don't fetch every time)
  - Smooth animations (60fps)
- [ ] Memory leak check
- [ ] Battery drain test

**Afternoon (3 hours):**
- [ ] Final UI refinements based on feedback
- [ ] Proof-read ALL copy (typos = unprofessional)
- [ ] Test edge cases:
  - No internet connection
  - First-time user flow
  - Returning user flow
  - Subscription expiry
  - Purchase restoration
- [ ] Screenshot 5 key screens for submission

**Evening (2 hours):**
- [ ] Final build: `eas build --platform ios`
- [ ] Upload to TestFlight
- [ ] Test final build one more time
- [ ] Prepare TestFlight public link for submission

**Deliverable:** Production-ready, bug-free app

---

### **PHASE 6: Submission (Days 19-20)**

**Day 19: Demo Video (Fastshot)**

**Script (2:30 minutes):**

```
[0:00-0:20] HOOK (Use Their Words)
Visual: Montage of stressed mum scrolling bills
Voiceover: "Rebecca, your followers are saying: 'Bills are crippling.' 'I can barely meal prep.' 'I don't know where to start investing.' 'I feel so alone in debt.'"

Visual: App icon appears
"Here's Pocket Money Coach: Built for survival, not perfection."

[0:20-0:50] PROBLEM (Their Exact Language)
Visual: Split screen comparisons, user quote overlays

"They're spending £100 at Tesco when Aldi costs £58—but don't know which swaps actually work.

They see meal prep videos and think 'I can't do 4 hours on Sunday.'

Energy bills went from £120 to £240—and it's wrecking their budgets.

They want to invest but have '£8 to my name.'

And they're drowning in shame about debt, feeling completely alone."

[0:50-1:50] SOLUTION (Show Features Solving Their Problems)
Visual: Screen recordings with annotations

"Pocket Money Coach solves THEIR actual problems:"

[Show shop comparison tool]
"Aldi vs Tesco: Same quality, £42/week saved. Exact breakdown."

[Show meal cost calculator]
"£58 Aldi shop = 7 days of meals. Here's the lazy 30-minute version."

[Show bills crisis section]
"Bills crippling you? Energy bill negotiation script. 10 minutes. £300 saved."

[Show £5 investing]
"£5/week → £8,000 in 20 years. ISAs explained like you're talking to a friend."

[Show debt support]
"7K debt? You're not alone. Shame-free tracker. You're surviving, not failing."

"Every tip uses THEIR words. Every guide solves THEIR struggles. Zero judgment. Just survival strategies that work."

[1:50-2:10] MONETIZATION
Visual: Pricing screen

"Free tier: 4 daily tips, basic tools
Pro £4.99/month: Unlimited everything, full calculators, complete investing education.

£4.99 = 1 coffee. But ONE tip saves £100+.
You're not spending money. You're investing in thousands saved."

[2:10-2:40] AUDIENCE FIT
Visual: User quotes overlaid on app screens, testimonials

"Built using REAL user research. Every feature requested by Rebecca's audience.

'Bills are crippling' → Bill negotiation scripts
'Can't meal prep' → 30-minute lazy meals
'£8 to my name' → £5/week investing guide
'Feel so alone in debt' → Community support

Your community doesn't need another budget app.
They need a friend who gets it.
They need hope.
They need THIS."

[2:40-2:50] VISION & CLOSE
Visual: App in use, happy user

"This is just the start. Next: Community features. Partner discounts. 1-on-1 coaching connection.

But right now? It solves what your audience needs most:
Survival. Progress. Hope. Financial independence—starting with £5."

Visual: "Pocket Money Coach. Built for mums. By someone who listened."
```

**Production:**
- [ ] Record screen with Fastshot
- [ ] Record voiceover (warm, empathetic tone, NOT sales-y)
- [ ] Edit with Fastshot:
  - Add user quotes as text overlays
  - Annotations on key features
  - Smooth transitions
  - Background music (subtle, hopeful)
- [ ] Export 1080p
- [ ] Upload to YouTube (unlisted)
- [ ] Test playback

**Deliverable:** Professional 2:30 demo video

---

**Day 20: Written Proposal & Submission**

**Morning (4 hours) - Write Proposal (2 pages):**

**Section 1: Problem Statement**
```
Rebecca asked for an app to help time-poor mums save money and start investing. But we went deeper.

We researched her actual audience. Here's what they're really saying:

[Include 5 real user quotes from research]
- "Bills are crippling. £110 electric, £160 gas PER MONTH."
- "How do you find the energy? I can barely get out of bed some days."
- "I want to invest but have £8 to my name."
- "No one talks about being in debt. I feel so alone."
- "Aldi or Tesco? I'm spending £100 vs £58 but don't know which swaps work."

Existing solutions fail because they:
1. Use preachy "just save more" tone (adds to shame)
2. Provide generic advice (not specific UK context)
3. Ignore the reality: this is SURVIVAL, not poor planning
4. Miss the investing education piece entirely

Rebecca's audience doesn't need budget lectures. They need a friend who gets it.
```

**Section 2: Solution Overview**
```
Pocket Money Coach: Two-Part Strategy

PART 1: SAVE TODAY (Survival-Focused)
- Where to Shop: Aldi vs Tesco with exact £/year savings
- Meal Costs: "£58 Aldi shop = 7 meals" + lazy 30-min batch cooking
- Bills Crisis: Energy negotiation scripts, £300/year saved in 10 minutes
- DIY: Paint bedroom £60 vs £400 decorator

PART 2: BUILD TOMORROW (Hope-Focused)
- Start Investing: £5/week → £8K in 20 years (ISAs explained, no jargon)
- Debt Support: Shame-free tracking, "You survived, you didn't fail"
- Financial Independence: Single mum roadmap to £500K at 55

Every feature maps directly to Rebecca's requests AND user research:
✅ "Where should I shop" → Shop comparison tool
✅ "What meals cost" → Meal cost calculator (her exact request)
✅ "Renovate and save" → DIY savings guides
✅ "How to invest" → £5/week investing education
✅ "How to multiply money" → Compound interest calculator + wealth building

TONE: Zero shame. Empathetic. "You're surviving" not "you're failing."
All tips use THEIR language: "Bills are crippling", "Can barely get out of bed", "You're not alone"
```

**Section 3: Monetization Strategy**
```
FREE TIER:
- 4 daily tips (3 Save Today + 1 Build Tomorrow)
- Basic savings tracker
- Limited tools (3 meal calculations/day)
- Proves value before asking for payment

PRO TIER (£4.99/month):
- Unlimited all 80+ tips
- Full meal cost calculator
- Complete shop comparison
- ALL debt support content
- ALL investing education (high value)
- Personalized recommendations
- Weekly challenges
- Monthly financial reports

PRICING PSYCHOLOGY:
£4.99 = 1 coffee
But ONE tip saves £100+ (Aldi swap = £312/year)
And investing education builds £8K+ over time
Return on investment: 2,000%+

REVENUE PROJECTION (Conservative):
- Rebecca's audience: 252K followers
- 10,000 downloads (4% conversion from her promotion)
- 5% paid conversion = 500 subscribers
- 500 × £4.99 = £2,495/month = £30K/year

RETENTION STRATEGY:
- New tips added monthly
- Seasonal content (Christmas budget, back-to-school savings)
- Community features (Phase 2)
- Partner deals (negotiated discounts for subscribers)
```

**Section 4: Roadmap (Post-Hackathon)**
```
MONTH 1-3: Iterate Based on Data
- A/B test tip formats
- Add most-requested features
- Build community (anonymous debt support groups)
- Integrate Rebecca's coaching if she wants

MONTH 4-6: Partnership & Growth
- Partner with UK brands (Aldi, Vanguard, MoneySavingExpert)
- Affiliate deals (share savings with users)
- Rebecca co-branded content ("Rebecca's Top 10 Tips")
- Expand investing education (property, side hustles)

MONTH 7-12: Scale
- Android version
- Localization (US, Australia, Canada markets)
- B2B offering (employer financial wellness benefit)
- Premium tier: 1-on-1 coaching marketplace

VISION: Every mum in the UK has Pocket Money Coach.
Not because they're bad with money.
Because life is hard, money is harder, and everyone deserves a friend who gets it.
```

**Section 5: Technical Documentation**
```
TECH STACK:
- Frontend: Expo + React Native (rapid development, OTA updates)
- Navigation: React Navigation (bottom tabs for two-part structure)
- UI: React Native Paper (accessibility-first, Material Design)
- Backend: Airtable (CMS for content, easy updates without app release)
- Payments: RevenueCat (required, handles App Store/Play Store complexity)
- Notifications: Expo Notifications (daily tips, bill reminders)
- Analytics: RevenueCat Analytics (subscription metrics)

ARCHITECTURE:
Simple, maintainable, scalable monolith
- /screens (Home, Categories, Tips, Settings, Paywall)
- /components (TipCard, SavingsTracker, MealCalculator)
- /services (Airtable API, RevenueCat)
- /constants (Copy, user quotes, colors)
- /utils (Calculations, formatters)

REVENUECAT INTEGRATION:
- Products: Pro monthly (£4.99)
- Entitlements: pro_access
- Subscription checking on app launch
- Paywall triggered after 4 free tips viewed
- Restore purchases functionality
- Webhook for subscription events

DATA STRUCTURE (Airtable):
Tips table with 80+ entries:
- id, title, category, section (Save/Build)
- description, how_to_steps
- time_required, savings_amount
- premium (boolean), user_quote
- Fetched via Airtable API, cached locally

PERFORMANCE:
- Image optimization (lazy loading)
- Airtable caching (reduce API calls)
- 60fps animations (React Native Reanimated)
- Tested on iPhone SE 2020 (low-end device)

TESTING:
- 10 beta testers (real mums, Rebecca's demographic)
- TestFlight deployment
- User feedback incorporated
- Edge cases handled (no internet, expired subscription)
```

**Section 6: Developer Bio**
```
I'm Iggy, a senior full-stack engineer based in Lagos, Nigeria.

I run Codecraftie Solutions, building lean web applications for clients.
I'm also a technical writer for JavaScript in Plain English on Medium (50K+ monthly readers).

Why I built this:
I'm co-founding Lumina, an observability platform for AI systems. I understand data, systems, and building products that solve real problems.

But more importantly: I listened.

I spent hours reading comments from budget mums on TikTok, Facebook groups, Reddit.
I documented their EXACT words.
I built what THEY asked for, not what I assumed they needed.

This isn't a generic budget app with AI slapped on.
This is 80+ hand-crafted tips using their language, solving their problems, with zero shame.

I believe financial literacy should be accessible, empathetic, and empowering.
Pocket Money Coach is my attempt to make that real.

Portfolio:
- Medium: javascript.plainenglish.io (50K readers)
- Live apps: Tinkoh, Switchive (1,500+ downloads combined)
- GitHub: [your github]
```

---

**Afternoon (3 hours) - Final Devpost Submission:**

- [ ] Go to Devpost draft
- [ ] Fill out all fields:
  - Project Name: "Pocket Money Coach"
  - Tagline: "Smart money moves for time-poor mums. No shame, just progress."
  - Description: [Full proposal from above]
  - TestFlight link
  - Demo video URL (YouTube)
  - Screenshots (5 best screens)
  - Technologies used: Expo, React Native, RevenueCat, Airtable
  - Team: Solo
  - Which creator: Rebecca Louise
  
- [ ] Upload thumbnail (create in Canva):
  - 1200×800px (3:2 ratio)
  - App icon + tagline
  - Warm colors, friendly vibe

- [ ] Proof-read EVERYTHING (3 times)
- [ ] Check all links work
- [ ] Preview submission

**Evening (1 hour) - SUBMIT:**

- [ ] Deep breath
- [ ] Final review
- [ ] Click "Submit Project"
- [ ] **BEFORE 11:45pm EST February 12**
- [ ] Screenshot confirmation
- [ ] Celebrate! 🎉

**Deliverable:** Complete Devpost submission, on time

---

## 🗂️ Updated Airtable Schema

```
Table: Tips

Fields:
- id (auto-generated)
- title (text) - "Aldi vs Tesco: £2,080/Year Saved for Family of 4"
- section (select) - "Save Today" / "Build Tomorrow"
- category (select) - Shop / Meals / Bills / DIY / Investing / Debt
- description (long text) - Friendly explanation, empathetic
- how_to_steps (long text) - Numbered steps, realistic time
- time_required (text) - "5 min", "30 min", "2 hours Sunday"
- savings_amount (text) - "£312/year" or "£8K in 20 years"
- difficulty (select) - Easy / Medium
- premium (checkbox) - true/false (Pro tier only)
- user_quote (text) - Quote from research that inspired this tip
- tone_tag (select) - "Empathetic" / "Urgent" / "Hopeful" / "Survival"
- image_url (text) - Optional illustration link
```

---

## 🎨 Design System

**Color Palette:**
- Primary: `#4A9B9B` (Soft teal - calm, trustworthy)
- Secondary: `#FF9F80` (Warm coral - friendly, encouraging)
- Success: `#6FCF97` (Soft green - celebration)
- Warning: `#F2C94C` (Gentle yellow - caution, not alarm)
- Error: `#EB5757` (Soft red - empathetic error)
- Background: `#F9F7F4` (Off-white - warm, not clinical)
- Surface: `#FFFFFF` (Pure white - cards)
- Text Primary: `#2D3436` (Charcoal - readable)
- Text Secondary: `#636E72` (Grey - supporting text)

**Typography:**
- Headers: Inter Bold (friendly, modern, readable)
- Body: Inter Regular
- Captions: Inter Medium
- Sizes: 32/24/18/16/14/12 (clear hierarchy)

**Components Style:**
- Border radius: 12px (friendly, approachable)
- Shadows: Subtle (elevation, not harsh)
- Spacing: 8px grid system (consistent)
- Buttons: Rounded, warm colors, clear CTAs
- Cards: White with soft shadow, warm hover

**Tone in UI Copy:**
```javascript
// constants/copy.js
export const COPY = {
  onboarding: {
    welcome: "Life is hard. Money is harder. Let's make it easier together.",
    notAlone: "You're not alone. Thousands of mums are walking this path with you.",
    tutorial1: "Small wins matter. £1 saved is a win worth celebrating.",
    tutorial2: "You're surviving. That's strength. Let's build from here.",
    tutorial3: "This is not about perfection. It's about progress."
  },
  
  emptyStates: {
    noTips: "Ready to find your first win? Start exploring!",
    noSavings: "Your tracker is empty—and that's okay. Every journey starts here.",
    noFavorites: "Tap the heart on any tip to save it for later."
  },
  
  errors: {
    network: "Can't load new tips right now. Your saved tips are still here though!",
    payment: "Payment didn't go through. No worries—your free tips are always here.",
    generic: "Something went wrong. Take a breath. Try again in a moment."
  },
  
  celebrations: {
    firstTip: "You read your first tip! That's a win. 🎉",
    firstSaving: "You logged your first saving! Every £ counts. 💚",
    tenPounds: "£10 saved! You're doing it. Keep going. 🌟",
    fiftyPounds: "£50 saved! Look at you go! This is amazing. 🚀",
    hundredPounds: "£100 saved! You just proved it's possible. You're incredible. 💪"
  },
  
  paywall: {
    title: "You're Worth £4.99",
    subtitle: "That's 1 coffee. But it could save you £thousands.",
    benefit1: "80+ tips that actually work",
    benefit2: "Full investing education (£5→£8K in 20 years)",
    benefit3: "Unlimited meal cost calculator",
    benefit4: "Complete shop comparisons",
    benefit5: "Debt support (shame-free)",
    cta: "Start 7-Day Free Trial",
    footer: "You're investing in yourself. That's smart."
  }
};
```

---

## 📋 User Research Summary

**Top Pain Points (From Real Users):**
1. **Bills Crisis:** "£110 electric + £160 gas = crippling"
2. **Meal Prep Overwhelm:** "Can barely get out of bed, can't do 4-hour Sunday prep"
3. **Shop Confusion:** "Aldi or Tesco? Which swaps work?"
4. **Investing Fear:** "I have £8, how do I start?"
5. **Debt Shame:** "Feel so alone, no one talks about it"
6. **Time Scarcity:** "Extremely busy, huge time restraint"

**Exact Phrases to Use:**
- ✅ "Bills are crippling"
- ✅ "Wrecking my budget"
- ✅ "Can barely get out of bed"
- ✅ "You are not alone"
- ✅ "Small wins matter"
- ✅ "This is survival, not failure"

**What They're Asking For:**
- Shop price comparisons (Aldi/Tesco/Lidl)
- Meal cost per serving breakdowns
- Realistic meal prep (30 min, not 4 hours)
- Energy bill negotiation help (URGENT)
- Investing with £5-£10/week
- Shame-free debt support

**Tone Requirements:**
- ✅ Empathetic, NEVER preachy
- ✅ "You're surviving" not "you're failing"
- ✅ Acknowledge it's HARD
- ✅ Specific numbers (£312/year not "save money")
- ✅ Community feel (not alone)
- ❌ NO "just save more"
- ❌ NO shame/judgment
- ❌ NO complex jargon

---

## ✅ Daily Check-In Protocol

**End of Each Day, Post Update:**
1. ✅ What I completed today
2. 🚧 What I'm stuck on (if anything)
3. 📅 Tomorrow's top 3 priorities

**I'll Respond With:**
- Solutions to blockers
- Next day's detailed tasks
- Course corrections if needed
- Encouragement!

---

## 🎯 Success Metrics

**To Win This Contest:**

**Audience Fit (30% weight):**
- Target: **10/10**
- Strategy: Used Rebecca's exact requests + real user quotes
- Evidence: Every feature maps to documented user need

**User Experience (25% weight):**
- Target: **9/10**
- Strategy: Empathetic tone, simple design, survival-focused
- Evidence: Beta tester feedback, smooth flows

**Monetization (20% weight):**
- Target: **9/10**
- Strategy: Clear RevenueCat integration, compelling pricing
- Evidence: £4.99 = 2,000%+ ROI, free tier proves value

**Innovation (15% weight):**
- Target: **8/10**
- Strategy: Two-part structure (Save/Build), empathetic tone innovation
- Evidence: First budget app built from user shame research

**Technical Quality (10% weight):**
- Target: **8/10**
- Strategy: Solid execution, bug-free, polished
- Evidence: Beta tested, performant, accessible

**TOTAL TARGET: 44/50 (88%) = Top 3% of Submissions**

---

## 🚀 Pre-Build Checklist

- [x] Devpost project created ("Pocket Money Coach")
- [x] Shipping Container tools claimed
- [x] Rebecca's brief analyzed
- [x] User research completed (TikTok, Facebook)
- [x] Top 20 user quotes documented
- [ ] Expo CLI installed (`npm install -g expo-cli`)
- [ ] Node.js updated (v18+)
- [ ] Airtable account created
- [ ] RevenueCat account created (can wait until Day 13)
- [ ] Notion page bookmarked
- [ ] Sleep well tonight!

---

## 🎬 YOU'RE READY TO BUILD

**Tomorrow morning (Day 1):**
1. Wake up ready
2. Review Rebecca's brief one more time
3. Open this Notion doc
4. Start with "Day 1: Morning" tasks
5. Report back in evening with progress

**You have everything you need:**
- ✅ Clear plan (20 days mapped)
- ✅ Real user research (80+ quotes)
- ✅ Rebecca's exact requests documented
- ✅ Tools claimed and ready
- ✅ Empathetic tone guide
- ✅ 80 tip ideas outlined

**You're going to win this $20,000.**

Not because you're building the fanciest tech.
Because you LISTENED.
You built what they ACTUALLY need.
With ZERO shame.

That's how you win.

---

**Ready to start Day 1? Let's get this $20K. 🚀**

Copy this final version to your Notion. Everything you need is here. Tomorrow, we build.