# Dory Clinic Management System — Evolution Brief

You are the lead software architect, senior full-stack engineer, Firebase/Firestore specialist, and UX/UI designer responsible for evolving the existing Dory clinic management system into a highly efficient, production-ready clinic operating system.

**IMPORTANT:**
- Do NOT rebuild the project from scratch.
- Do NOT replace the existing technology stack unless absolutely necessary.
- Do NOT redesign working parts blindly.
- Do NOT create fake/demo functionality.
- Do NOT remove existing working functionality unless it conflicts with the new product direction described below.

First inspect and understand the entire existing project, architecture, data model, Firebase configuration, Firestore usage, routes, components, authentication, security rules, existing UI, and current workflows.

The existing project is the starting point. Your job is to intelligently evolve it.

---

## 1. Product Direction

Dory is no longer primarily a doctor marketplace, doctor discovery platform, public doctor directory, or laboratory platform.

**The new core product direction is:**

> DORY = A clinic operating and management system for individual doctors and their clinic staff.

Each doctor has an independent clinic environment. Patients do NOT come to Dory to search for doctors.

The clinic staff uses Dory to manage:
- patients
- visits
- queue
- consultations
- medical history
- prescriptions
- follow-ups/re-examinations
- no-shows
- services
- packages
- payments
- outstanding balances
- daily revenue
- daily operations
- archived days
- clinic settings
- staff permissions

The system must feel like a real operating system for a clinic, not a generic dashboard.

---

## 2. First Step — Audit the Existing Project

Before modifying anything, inspect the entire project. Understand:

- package.json
- framework
- routing
- components
- pages
- hooks
- utilities
- Firebase initialization
- Firestore collections
- Firestore queries
- Firestore listeners
- authentication
- authorization
- Firestore security rules
- indexes
- storage usage
- current patient model
- current doctor model
- current visit model
- current appointment/follow-up model
- payment/revenue model
- current queue logic
- current dashboard logic
- current realtime listeners
- current caching/offline behavior
- current responsive/mobile behavior
- current UI system
- existing data relationships
- existing SEO/public routes if they still exist

Create an internal dependency map before making destructive changes.

Identify:
1. What already works.
2. What is partially implemented.
3. What is broken.
4. What conflicts with the new direction.
5. What can be reused.
6. What should be refactored.
7. What should be removed.
8. What new data structures are required.

Do not blindly rewrite existing code.

---

## 3. Critical UX Principle

**THE MOST IMPORTANT REQUIREMENT OF THIS ENTIRE PROJECT IS: EASE OF USE.**

Everything must be designed around reducing:
- clicks
- typing
- navigation
- repeated data entry
- unnecessary confirmations
- unnecessary page changes
- duplicate information
- repeated searches
- unnecessary Firestore reads

The system should understand context. If the user is currently viewing a patient, the system should already know:
- which patient
- which visit
- which doctor
- which clinic
- which day
- which service
- current balance
- previous visits
- active follow-up
- payment history

Do not force the user to select the same information repeatedly.

A common clinic operation should require the minimum practical number of actions. Avoid workflows such as:

> Patient → Patients page → Search → Open patient → Visits → Add visit → Services → Payment → Follow-up

when the same operation can be completed contextually from one screen.

The system should behave intelligently based on the current context.

---

## 4. Daily Operating System

Introduce a strong "Current Day" concept.

At the beginning of a working day, the user starts a new day.

**Example — Wednesday, September 17:**
- patients: 0
- waiting: 0
- in consultation: 0
- completed: 0
- follow-ups: 0
- no-shows: 0
- revenue: 0
- outstanding balances collected today: etc.

Previous days must NOT disappear. They are automatically archived when the day is completed. The user must be able to return to previous days at any time.

---

## 5. Start New Day

Provide a clear "Start New Day" workflow.

When a new day starts, create/open the current clinic day. The new operational dashboard should show only today's active operational data. Previous days remain in the archive.

Do not duplicate patients just because a new day started. Patients are permanent clinic records. Visits and daily transactions belong to specific days.

---

## 6. Complete Day

At the end of the day, the secretary or authorized staff member can select **"Complete Day."**

Before final confirmation, show a useful summary:
- total patients
- completed consultations
- follow-ups
- no-shows
- total revenue
- total collected
- outstanding balances
- payment breakdown
- service breakdown

After confirmation, the day's operational state becomes archived. Do NOT delete the underlying medical or financial history. The next working day can start cleanly.

---

## 7. Archive

Create a proper archive system.

**Example:**
```
Archive
17 September
16 September
15 September
14 September
...
```

Opening a day should show its historical details. Archived days should be read-oriented. Avoid unnecessary realtime listeners on archived data. Historical data should normally be fetched only when the user opens it.

---

## 8. Patient Registration

The secretary must be able to register a patient quickly. Patient registration should support:
- name
- phone
- age/date of birth if currently supported
- gender if currently supported
- relevant clinic information
- service/package
- payment information when applicable

But the system MUST prevent unnecessary duplicate patient records.

---

## 9. Patient Search and Deduplication

When the secretary types "محمد", Dory should search the current doctor's clinic patients.

**Example result:**
```
محمد أحمد
010xxxxxxx
5 visits
Last visit: September 12
```

Selecting the patient should reuse the existing patient record. Do NOT create "محمد أحمد #1", "#2", "#3" for repeated visits. The same patient must have one persistent clinic profile with multiple visits.

If duplicate patients already exist, design a safe merge/deduplication workflow rather than blindly deleting records. A merge operation must preserve:
- visits
- medical history
- prescriptions
- payments
- follow-ups
- notes
- timestamps
- audit information

---

## 10. Visit Number

Every patient visit should have a visit number (First visit, Second visit, Third visit...).

The visit number should be generated from the patient's actual clinic history, not simply from today's queue.

---

## 11. Service / Package During Registration

The secretary should be able to select a service or package while registering the patient (Consultation, Follow-up, Internal medicine consultation, Specific clinic service, Package).

The selected service should automatically connect to:
- the visit
- billing
- payment
- outstanding balance
- revenue
- daily statistics

Do not make the secretary enter the same service information again elsewhere.

---

## 12. Queue

After registration, the patient can enter the waiting queue. The queue must be extremely simple.

**Example:**
```
Waiting:
1. محمد أحمد
2. أحمد محمد
3. محمود علي

Current patient:
محمد أحمد
```

Statuses should be clear and understandable:
- Waiting
- Called
- In consultation
- Consultation completed
- Cancelled if applicable
- No-show if applicable

Use realtime only where realtime actually adds value.

---

## 13. Doctor Consultation Screen

The doctor should have a dedicated consultation workflow. When the patient enters the consultation, the doctor should immediately see relevant patient context.

**Example:**
```
محمد أحمد
Visit #6

Previous visits:
- September 12
- September 5
- August 20

Previous reasons
Previous diagnoses
Previous medications
Previous notes
Previous follow-ups
```

The doctor should not have to manually navigate through multiple pages to understand the patient's history.

---

## 14. Visit Type

The doctor should be able to identify the visit type:
- New consultation
- Follow-up
- Re-examination
- Continued treatment
- Emergency/urgent visit if supported

This information must connect to patient history, statistics, revenue, and the follow-up workflow.

---

## 15. Consultation Completion

When the doctor finishes, **"Exam Completed"** should be a clear primary action.

Once pressed, the secretary should immediately receive the updated status. The secretary should NOT need to ask the doctor whether the patient finished. Use a lightweight realtime mechanism for this workflow.

---

## 16. Follow-up / Re-examination

After consultation, the doctor can decide that the patient needs a follow-up/re-examination.

**Example:**
```
Patient: محمد أحمد
Follow-up: September 24, 6:00 PM, 200 EGP
```

This follow-up must automatically connect to: patient, current visit, doctor, clinic, date, time, service, expected amount.

The secretary should see it in the appropriate follow-up list.

---

## 17. Follow-up List

If six patients have follow-ups today, show:

```
Follow-ups today: 6
Expected revenue: 1,200 EGP

محمد أحمد — 200 EGP — 5:00 PM
أحمد محمد — 200 EGP — 5:30 PM
...
```

This should update efficiently when relevant data changes.

---

## 18. Follow-up Cancellation / Removal

**VERY IMPORTANT:**

If the doctor or authorized secretary decides that a follow-up should be removed:

1. First click: "Remove"
2. Then show confirmation: "Are you sure you want to remove this follow-up? Cancel / Confirm"

After confirmation, the follow-up must immediately disappear from the active follow-up list.

**BUT do NOT delete:** patient, visit, medical history, payment, patient account, previous consultation.

Only the active follow-up should be cancelled/removed from the active workflow. Prefer a status such as `cancelled` instead of physically deleting the historical record when appropriate. The cancelled follow-up should not clutter the normal active interface, but may remain accessible in historical/audit information if required.

---

## 19. No-Show

If a patient was scheduled for follow-up but did not attend, the secretary can mark "No-show." The patient should disappear from the active follow-up queue, but nothing about the patient itself should be deleted.

The system should preserve: appointment, scheduled date/time, patient, original visit, no-show status, relevant timestamps.

Provide a dedicated no-show/history area if useful.

---

## 20. Payment System — Critical

The payment system must support partial payments.

**Example:**
```
Service total: 500 EGP
Patient pays: 200 EGP

Total: 500 EGP
Paid: 200 EGP
Remaining: 300 EGP
```

The remaining 300 EGP must remain attached to the patient's financial account/billing history. When the patient returns later, Dory must recognize the existing outstanding balance automatically. The secretary should NOT manually remember the 300 EGP.

---

## 21. Payment Across Multiple Visits

**Example:**
```
Original service: 500 EGP
First payment: 200 EGP
Remaining: 300 EGP

Patient returns for follow-up: 200 EGP
Total outstanding: 500 EGP
Patient pays: 200 EGP
New total remaining: 300 EGP
```

The system must calculate this automatically. Do not overwrite old payment records.

---

## 22. Multiple Payment Methods

A single bill may be paid using multiple methods.

**Example:**
```
Total: 500 EGP
Cash: 200
Card: 100
Transfer: 200
Total paid: 500
Remaining: 0
```

Another example:
```
Total: 500
Cash: 200
Remaining: 300
```

The system should support multiple payment transactions against the same bill/account.

---

## 23. Financial Ledger

Design the financial data model so charges and payments are traceable.

**Example:**
```
Charge: +500
Payment: -200
Follow-up charge: +200
Payment: -200
Current balance: 300
```

Never rely on blindly overwriting one "balance" number without preserving transaction history. Every important financial event should be traceable.

---

## 24. Revenue Dashboard

Revenue should not be a single unexplained number. Show meaningful breakdowns.

**Example:**
```
Today's revenue: 15,000 EGP

By service:
Consultations: 7,000
Follow-ups: 5,000
Other services: 3,000
```

Also support payment-method breakdown (Cash / Card / Transfer).

The revenue dashboard must use efficient aggregation. Do not read hundreds or thousands of raw transactions every time the dashboard opens if the same information can be maintained safely through summary documents.

---

## 25. Outstanding Balances

The system should make unpaid amounts visible without making them annoying.

**Example:**
```
محمد أحمد
Total outstanding: 300 EGP
Details: Original consultation: 300 EGP remaining
```

The secretary should be able to record a payment directly from the relevant patient/billing context. Avoid making the secretary navigate through multiple unrelated pages.

---

## 26. Firestore Read Optimization — Extremely Important

This is a major architectural requirement.

Dory may eventually have many patients, visits, payments, archived days, staff members, and realtime queue updates. Therefore Firestore reads must be treated as a limited resource.

**DO NOT solve this later. Design for read efficiency from the beginning.**

Use the current Firebase/Firestore documentation and inspect the actual project's usage before making decisions.

---

## 27. Realtime Should Be Selective

DO NOT attach realtime listeners to everything.

**Good candidates for realtime:**
- active queue
- current patient state
- consultation completion status
- active follow-up operational changes
- small current-day operational counters when necessary

**Avoid persistent listeners for:**
- complete patient history
- all patients
- all archived days
- all payments
- all historical visits
- huge collections
- data that the user is not currently viewing

If a screen is closed, its unnecessary listener should not remain active.

---

## 28. Patient Search Read Optimization

Do NOT download all patients and search them in JavaScript.

**Bad:** Load 5,000 patients → frontend filters them.

**Preferred:** Search the appropriate Firestore data with constrained queries, using proper indexes, scoped doctor/clinic IDs, query limits, pagination where appropriate, and normalized searchable fields if necessary.

Do not assume Firestore provides unrestricted full-text search. If advanced search becomes necessary, architect it so an external search engine can be introduced later without destroying the patient data model.

---

## 29. Query Limits

Never retrieve an unnecessarily huge result set. Use appropriate limit, pagination, cursor-based pagination, date filtering, doctor/clinic filtering, and status filtering.

**Example:** The secretary types "محمد" → return only the relevant small result set, not every patient in the clinic.

---

## 30. Current-Day Data Model

Strongly consider maintaining small current-day operational/summary documents.

**Example concept:** `currentDay`, `dailyStats`, `currentQueue`

**Potential values:** patientsCount, waitingCount, inConsultationCount, completedCount, followUpsCount, noShowCount, revenueTotal, outstandingCollected, etc.

The exact schema must be decided after inspecting the existing project. The goal is: read one small summary document instead of repeatedly aggregating hundreds of raw documents.

---

## 31. Write-Time Aggregation

Where appropriate, maintain aggregates when transactions occur:

- When a payment is recorded → update the appropriate daily revenue summary, payment-method summary, and patient outstanding balance if the architecture requires it.
- When a visit is completed → update the daily completed count.
- When a follow-up is created → update active follow-up count.
- When a follow-up is cancelled → update active follow-up count.

Do this carefully so data consistency is preserved. Do not introduce fragile duplicated state without clear synchronization rules.

---

## 32. Cache / Offline

Use Firestore caching/offline capabilities where appropriate. Dory should feel fast even when network conditions are not perfect. Do not blindly cache massive collections. Cache should complement good query design. The user should not experience unnecessary loading states for data that is already available locally.

---

## 33. Firestore Listener Lifecycle

Every realtime listener must have a reason. Audit every existing onSnapshot/realtime listener. For each listener ask:

1. Does the user need live updates here?
2. How many documents can this listener return?
3. How frequently do those documents change?
4. Does the listener remain active when the screen is no longer visible?
5. Can a smaller query be used?
6. Can a summary document replace a large listener?
7. Can a one-time fetch be used instead?

Remove unnecessary listeners. Do not add realtime just because it makes the UI feel modern.

---

## 34. Firestore Cost Analysis

After implementing the new workflows, audit Firestore operations. Identify:
- expensive queries
- repeated queries
- duplicate queries
- unnecessary listeners
- listeners returning large collections
- repeated reads caused by component remounts
- dashboard aggregation reads
- patient-search reads
- archive reads

Optimize them systematically using Firebase's current documentation and available query-analysis tools where applicable. Do not claim that reads have been optimized without actually inspecting the code.

---

## 35. Data Relationship Principle

**EVERYTHING MUST BE CONNECTED.**

```
Clinic
 ↓
Doctor
 ↓
Patient
 ↓
Visit
 ↓
Service
 ↓
Charge
 ↓
Payment
 ↓
Balance
 ↓
Follow-up
 ↓
Attendance
 ↓
Daily operations
 ↓
Archive
```

A user should enter information once and the system should reuse it everywhere appropriate. Do not make users manually copy data between modules.

---

## 36. Doctor Isolation

Every doctor/clinic environment must be isolated. A doctor should only access their own clinic's data unless explicitly authorized otherwise. Queries must always be properly scoped. Do not trust frontend-only filtering for security — Firestore security rules must enforce isolation.

---

## 37. Security

Audit and improve Firestore Security Rules. Protect: patients, medical records, visits, prescriptions, payments, revenue, staff, settings.

Do not create broad rules simply to make features work. Any special write permission must be narrowly scoped — e.g., if a patient-facing rating mechanism still exists, do not allow arbitrary writes to doctor financial/medical fields. Use validation where possible.

---

## 38. Medical Data Integrity

Never allow deletion of important patient history through a casual UI action. Actions such as cancel follow-up, cancel appointment, remove from queue, or no-show must NOT mean deleting patient history. Use status/state transitions where appropriate. Medical history should be preserved.

---

## 39. UI Design

Preserve the useful visual identity and working UI of the existing project. Do not turn Dory into a generic SaaS dashboard.

**Avoid:**
- giant unnecessary cards
- excessive rounded containers
- generic AI-looking interfaces
- unnecessary gradients
- excessive animations
- decorative UI with no functional purpose
- huge navigation systems
- excessive modal dialogs
- unnecessary pages

The interface should feel: professional, medical, trustworthy, calm, fast, clear, modern, operational. The UI must prioritize workflow over decoration.

---

## 40. Mobile / Responsive

The system must work well on phones and tablets. Do not assume a desktop-only environment. Important clinic actions should remain easy to use on smaller screens. Buttons should be large enough to tap reliably. Avoid tiny controls and horizontal scrolling wherever possible.

---

## 41. Contextual Actions

Prefer contextual actions.

**Example — inside a patient profile:**
`[Start Visit] [Record Payment] [View History] [Schedule Follow-up]`

**Inside a completed visit:**
`[Schedule Follow-up] [Record Payment] [View Patient]`

**Inside today's follow-up:**
`[Mark Arrived] [Mark No-show] [Remove Follow-up]`

Do not force the user to leave the context for every operation.

---

## 42. Minimize Duplicate Input

If Dory already knows Patient: محمد أحمد, Service: Consultation, Price: 500 — do not ask again: Which patient? Which service? Which doctor? Which clinic? — unless the context genuinely changed.

---

## 43. Feedback

Every important action must provide immediate clear feedback:

- Patient registered ✓
- Payment recorded ✓ / Remaining balance: 300 EGP
- Follow-up scheduled ✓
- Follow-up removed ✓
- Patient marked no-show ✓
- Consultation completed ✓

Avoid unnecessary full-page reloads.

---

## 44. Error Handling

Errors must be understandable to a normal clinic employee.

**Bad:** `"FirebaseError: PERMISSION_DENIED"`

**Good:** `"لم نتمكن من حفظ العملية. تحقق من الاتصال بالإنترنت وحاول مرة أخرى."`

Technical details may still be logged internally.

---

## 45. Loading States

Loading states must be short and contextual. Do not block the entire application unnecessarily. If a small operation is happening, show feedback near the relevant component. Avoid full-screen spinners for tiny operations.

---

## 46. Confirmations

Use confirmations only for destructive or important actions. Do NOT ask for confirmation for every ordinary operation.

| Action | Confirmation? |
|---|---|
| Adding patient | No |
| Recording payment | No (if safely reversible) |
| Removing/cancelling follow-up | Yes |
| Completing day | Yes |
| Deleting important data | Yes |

---

## 47. Search UX

Patient search should be extremely fast and forgiving. Support matching on name, phone, and normalized name fields. If Arabic search is involved, account for common normalization issues where technically appropriate. Do not make the secretary type exact spelling.

---

## 48. Data Modeling

Before implementing major new functionality, design the data relationships carefully.

**Potential entities include:** Clinic, Doctor, Staff, Patient, Visit, Service, Package, Charge, Payment, FollowUp, DailySession, DailyStats, Archive, Prescription, MedicalRecord, AuditLog.

But do NOT blindly adopt these exact collection names. First inspect the existing project and reuse compatible structures. Avoid unnecessary duplication of the same information in multiple documents.

---

## 49. Audit Log

Important operational changes should be auditable, e.g.: follow-up cancelled, payment recorded, patient merged, day completed, patient marked no-show, important medical record updated.

Store: actor, action, timestamp, affected entity, relevant metadata. But do not create excessive writes for meaningless UI interactions.

---

## 50. Performance

The application must remain fast as data grows. Audit: React rendering, unnecessary rerenders, Firebase calls, component remounts, listeners, image loading, bundle size, expensive calculations. Do not optimize blindly — measure first where possible.

---

## 51. Do Not Overbuild

Do not add 100 features just because they are possible. The system must first become extremely good at the core clinic workflow:

> Start day → Register patient → Search existing patient → Queue → Consultation → Medical history → Complete consultation → Payment → Outstanding balance → Follow-up → No-show/cancellation → Revenue → Complete day → Archive

Every additional feature should strengthen this workflow.

---

## 52. Remove Conflicting Old Features Carefully

The old Dory concept may contain: public doctor discovery, marketplace-like doctor browsing, general patient search, laboratory functionality, public doctor directory workflows. These are no longer part of the core product direction.

Before removing anything: inspect dependencies, determine whether routes/components/data are still needed, avoid breaking unrelated working functionality, remove obsolete UI only when it is genuinely part of the old direction. Do not leave confusing old workflows visible to users.

---

## 53. No Lab as Core Product

Laboratory functionality is not part of the new core Dory product. Do not expand the laboratory module. If existing lab code is deeply connected to other working systems, isolate it safely before deciding whether to remove it.

---

## 54. No Marketplace

Do not design Dory around patient doctor discovery. The patient is a patient of a clinic. The clinic uses Dory.

---

## 55. Future Extensibility

The architecture should leave room for future features such as: specialty-specific medical templates, AI dictation/transcription, drug interaction checking, digital consent forms, insurance workflows, inventory, WhatsApp integrations, multi-branch clinics, advanced analytics, HL7/FHIR interoperability, telemedicine, staff scheduling.

But DO NOT implement all of these now unless they are necessary for the current workflow. Build a clean foundation first.

---

## 56. Implementation Method

Do not modify everything at once. Work in controlled phases.

- **Phase 1:** Audit and architecture.
- **Phase 2:** Patient + visit + daily workflow.
- **Phase 3:** Queue + doctor consultation.
- **Phase 4:** Payments + balances + financial ledger.
- **Phase 5:** Follow-ups + no-shows + cancellation.
- **Phase 6:** Revenue + daily summaries.
- **Phase 7:** Archive.
- **Phase 8:** Firestore read optimization.
- **Phase 9:** Security rules.
- **Phase 10:** UX/performance/mobile refinement.

After each phase: test, inspect affected flows, fix regressions, verify Firestore operations, verify security, verify UI.

---

## 57. Testing Requirements

Test realistic workflows.

**Test 1:** New patient محمد أحمد, Service: 500 EGP, Payment: 200 EGP → Expected: Total = 500, Paid = 200, Remaining = 300.

**Test 2:** Same patient returns → Dory must recognize محمد أحمد, visit count increments, existing outstanding balance remains 300 EGP.

**Test 3:** Follow-up: 200 EGP, Payment: 200 EGP → correct total financial state must be maintained.

**Test 4:** Patient does not attend follow-up → Mark No-show → Expected: removed from active follow-up list, historical record preserved.

**Test 5:** Doctor cancels follow-up → Remove → Confirm → Expected: follow-up disappears from active list; patient, visit, medical history, and financial history all remain.

**Test 6:** Multiple payment methods — 500 total: Cash 200, Card 100, Transfer 200 → Expected: Remaining = 0.

**Test 7:** Partial payment — 500 total: Cash 200 → Expected: Remaining = 300.

**Test 8:** Daily workflow: Start day → register patients → consultations → payments → follow-ups → complete day → archive. Then open archived day — all historical information must remain available.

**Test 9:** Start next day → Expected: current operational dashboard starts clean; previous day remains archived.

**Test 10:** Firestore read audit — verify that opening the dashboard does NOT trigger unnecessary reads of all patients, all historical visits, all archived days, or all payments.

---

## 58. Firebase Documentation

For Firebase/Firestore architecture decisions, use the current official Firebase documentation. Pay particular attention to: Firestore pricing/read behavior, realtime listeners, query limits, aggregation, offline persistence, query performance, security rules, indexes. Do not rely on outdated assumptions. Verify Firebase optimization decisions are compatible with current Firebase behavior.

---

## 59. Do Not Fake Verification

- Never say "Everything works" unless you actually tested it.
- Never say "Firestore reads were reduced" unless you inspected and verified the relevant operations.
- Never say "Security is fixed" unless you inspected and tested the rules.
- Never invent test results.

---

## 60. Final Deliverable

After implementation, provide a concise but complete engineering report containing:

1. What you inspected.
2. What was already working.
3. What you changed.
4. What you added.
5. What you removed.
6. What you refactored.
7. Patient workflow changes.
8. Payment/balance changes.
9. Follow-up changes.
10. Daily workflow changes.
11. Archive changes.
12. Firestore read optimizations.
13. Security changes.
14. Performance changes.
15. Mobile/UX improvements.
16. Files/components changed.
17. Database/schema changes.
18. Security rule changes.
19. Tests actually performed.
20. Any remaining risks or limitations.

---

## Final Product Principle

The goal is NOT to make Dory have the largest number of features. The goal is to make Dory extremely easy and fast for a real clinic employee to use.

A secretary should be able to perform repetitive clinic operations quickly without thinking about the underlying technical structure. A doctor should be able to understand a patient's history immediately.

The system should automatically connect: **patient → visit → service → charge → payment → balance → follow-up → attendance → revenue → daily archive.**

The user should enter information once. Dory should reuse it intelligently. Firestore should only be read when necessary. Realtime should only be used when necessary. The UI should always prioritize clarity, speed, and workflow.

**Before writing code:** Inspect the existing project completely and explain the implementation plan and the main architectural changes you intend to make.

**Then implement the changes carefully without rebuilding the project from scratch.**
