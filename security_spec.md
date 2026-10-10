# Dory Booking System Security & Hardening Specification

## 1. Data Invariants

- **Daily Counters Invariant**: Every booking transaction must atomically update `queues/{doctorId}/dailyCounters/{dateId}` with `lastSequenceNumber` incremented by 1.
- **Queue Number Monotonicity**: Patient tickets must receive sequence numbers >= 1 without duplicate numbers issued for the same doctor on the same date.
- **Idempotency & Phone Uniqueness**: A patient phone number can only have ONE active ticket (`waiting` or `called`) per doctor per day.
- **Data Protection**: Patient notification fields and sequence numbers are system-managed and cannot be overwritten by client-side patient updates.
- **Phone Normalization**: All Egyptian phone numbers must normalize to 11-digit local format (`010XXXXXXXX`, `011XXXXXXXX`, `012XXXXXXXX`, `015XXXXXXXX`).
- **Timezone Invariant**: Queue dates are strictly computed in `Africa/Cairo` local time.

## 2. Dirty Dozen Payloads Test Matrix

1. **Spoofed Sequence Jump**: Attempting to book with a custom client-controlled `sequenceNumber: 9999`.
2. **Duplicate Parallel Booking**: Rapid parallel submissions with the same phone number attempting to bypass rate limits and create twin tickets.
3. **Double Click Collisions**: Double tapping submit within 10ms to trigger twin transaction execution.
4. **Invalid Phone Format**: Submitting phone numbers with letters, malicious scripts, or invalid lengths.
5. **Arabic Numeral Mismatch**: Submitting `٠١٠١٢٣٤٥٦٧٨` expecting different record creation from `01012345678`.
6. **Inactive Clinic Exploitation**: Submitting a ticket request to a doctor with `isActive: false`.
7. **Expired Subscription Exploitation**: Submitting a ticket request to a doctor with `subscriptionStatus: expired`.
8. **Max Daily Limit Exceeded**: Submitting ticket #51 when doctor's `maxPatientsPerDay` is 50.
9. **Notification Flag Manipulation**: Patient attempting to set `notifiedForTwoTurns: true` on ticket document.
10. **Doctor ID Spoofing**: Attempting to alter `doctorId` on existing patient document.
11. **Midnight Rollover Sync Failure**: Booking at 23:59:59 UTC vs 01:59:59 Cairo local time.
12. **Negative / Zero Counter Injection**: Attempting to set `lastSequenceNumber: -1` in `dailyCounters`.

## 3. Test Verification Matrix
All 12 payloads are tested and blocked by atomic Firestore transactions, validation rules in `firebaseService.ts`, rate limiters in `securityService.ts`, and strict field controls in `firestore.rules`.
