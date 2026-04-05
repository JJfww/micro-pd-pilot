# Step 4: Message Flow Template

Use this document to define exactly how one lesson moves through the system from assignment to completion.

## Purpose

This document answers:

- what happens when a lesson starts
- what is sent automatically
- what the app waits for
- what happens when a user replies
- when reminders are sent
- when a lesson is marked complete

This is the behavioral spec for the MVP.

## Recommended Core Flow

For your pilot, each lesson should follow this sequence:

1. Send `concept`
2. Send `check_understanding`
3. Wait for MC reply
4. Score the MC reply
5. Send the correct feedback or incorrect feedback
6. Send `explanation`
7. Send `application`
8. Send `reflection`
9. Wait for free-text reply
10. Mark the lesson complete

This works well for your current content format and keeps the lesson interactive without becoming too complex.

## Why This Order

This order is recommended because:

- the user gets the concept first
- the MC question checks understanding before extra explanation
- feedback is immediate
- explanation and application reinforce the key point
- reflection captures engagement and applied thinking

## Alternative Flow

If you want a lighter experience later, you could use:

1. Send `concept`
2. Send `check_understanding`
3. Wait for MC reply
4. Send feedback
5. Send `reflection`
6. Wait for reply
7. Mark complete

For now, keep the fuller version unless you decide it feels too long in testing.

## App Behavior By Step

### 1. Lesson assignment is created

When the app assigns a lesson to a user:

- create a `lesson_assignment`
- set status to `scheduled`
- store the intended send time

### 2. Scheduled send begins

At the scheduled time:

- send the `concept` step
- send the `check_understanding` step
- update the assignment status to `in_progress`
- record outbound message events

Recommended note:

- you may choose to send `concept` and `check_understanding` a few seconds apart
- or send them back-to-back if that feels natural in testing

### 3. Wait for MC reply

After the MC step is sent:

- pause the lesson
- wait for an inbound reply
- normalize the response

Examples:

- `A`
- `a`
- `b`
- `Choice B`

These should all be normalized before scoring.

### 4. Score MC reply

When a reply is received:

- identify the active assignment
- identify the pending step
- compare the normalized reply to `correct_answer`
- store the response

If correct:

- mark `is_correct = true`
- set `completed_mc_at`

If incorrect:

- mark `is_correct = false`
- still set `completed_mc_at`

For the pilot, the MC response counts as MC completion whether the answer is right or wrong.

### 5. Send feedback

Immediately after scoring:

- if correct, send `feedback_correct`
- if incorrect, send `feedback_incorrect`

This should feel immediate, not delayed to a later batch.

### 6. Send explanation and application

After feedback:

- send the `explanation` step
- send the `application` step

These can go back-to-back in the MVP.

### 7. Send reflection

After the application step:

- send the `reflection` step
- mark the assignment as waiting for reflection reply

### 8. Wait for reflection reply

When the user replies to the reflection:

- store the response
- optionally score it later
- mark `completed_full_at`
- update the assignment status to `completed_full`

For the first pilot, you do not need automated scoring of free text.

## Reminder Rules

Use the reminder rules from your pilot rules template.

Recommended MVP behavior:

- if no MC reply after 24 hours, send one reminder
- if no reflection reply after 24 hours, optionally send one reminder
- do not send repeated reminders

Suggested reminder examples:

- `Quick reminder: reply with A, B, or C to complete this micro-lesson.`
- `Quick reminder: send one short response to finish this micro-lesson.`

## Completion Rules

The app should track both:

- `completed_mc`
- `completed_full`

Recommended logic:

- `completed_mc`: set after any MC reply is received
- `completed_full`: set after reflection reply is received

This gives you two engagement levels without making reporting complicated.

## Opt-Out Behavior

If a user replies with:

- `STOP`
- `UNSUBSCRIBE`
- `QUIT`

then the app should:

- mark the user as opted out
- stop future sends
- stop the current lesson
- log the event

## Invalid or Unexpected Replies

For MVP, keep this simple.

### If the user replies to MC with something invalid

Example:

- `I think maybe B?`

Recommended behavior:

- try to normalize if possible
- if it cannot be matched, send:
  - `Please reply with A, B, or C.`

### If the user replies unexpectedly when no step is waiting

Recommended behavior:

- log the reply
- do not advance the lesson
- optionally send:
  - `Thanks. There is no active question right now.`

You may choose to suppress that message to avoid noise.

## Delivery Failure Behavior

If an outbound message fails:

- record the failure in `message_events`
- mark the assignment as `failed` if the lesson cannot continue
- do not repeatedly retry invalid numbers

## Suggested State Model

An assignment can move through these states:

- `scheduled`
- `in_progress`
- `waiting_for_mc`
- `waiting_for_reflection`
- `completed_mc`
- `completed_full`
- `incomplete`
- `opted_out`
- `failed`

For MVP, you can simplify the UI and still keep these states in the database.

## Decision Points For This Step

Before build, confirm:

1. whether `concept` and `check_understanding` send immediately one after another - Yes
2. whether explanation and application send immediately after feedback - Yes
3. whether reflection reminder is enabled - Yes
4. whether invalid MC replies should get a correction prompt - No 

## Next Step

After this message flow is settled, the next step is:

`Step 5: Build Plan`

That step will define the order of implementation for the Cloudflare app, Twilio integration, CSV import, and testing flow.
