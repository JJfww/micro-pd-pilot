# Pilot Rules Template

Use this file to define the operating rules for the micro-PD pilot before building the app.

## Purpose

This document answers:

- who receives lessons
- when lessons send
- how each lesson flows
- what counts as completion
- what engagement is tracked
- what happens if someone opts out or never replies

## Template

```txt
pilot_group: Pinckney Teachers and support staff
pilot_size: 20
start_date: 4/13/2026
send_days: Monday, Thursday 
send_time: 2:25 PM
timezone: America/Chicago
lessons_per_week: 2
lesson_flow:  send concept, check_understanding, wait for MC reply, send explanation/application, send reflection, wait for reply
reminder_rule: one reminder after 24 hours if no MC reply
completion_rule: track both MC completion and full completion
engagement_metrics: delivered, MC replied, MC correct, reflection replied, response time
opt_out_rule: stop messages on STOP or manual removal
failure_rule: log failures, suppress invalid numbers, no repeated retries
```

 
## Guidance By Field

### `pilot_group`

Which roster subgroup receives the pilot first, such as `cohort_a`.

### `pilot_size`

How many staff are included in the pilot.

### `start_date`

The date the first lesson should go out.

### `send_days`

The weekdays lessons should send. Since your plan is 2 lessons per week, define the exact days.

Example:

`Tuesday, Thursday`

### `send_time`

The time of day the lessons should send.

Example:

`3:45 PM`

### `timezone`

Use the timezone the app should rely on for scheduling.

Example:

`America/Chicago`

### `lessons_per_week`

The number of lessons per week.

Example:

`2`

### `lesson_flow`

Define how one lesson runs. Recommended flow:

1. Send `concept`
2. Send `check_understanding`
3. Wait for MC reply
4. Send `explanation`
5. Send `application`
6. Send `reflection`
7. Wait for reply

If you want a lighter experience, you can treat the reflection as optional.

### `reminder_rule`

Choose whether reminders are sent if there is no reply.

Recommended:

`one reminder after 24 hours if no MC reply`

### `completion_rule`

Define completion before launch.

Recommended:

- `MC completion`: user answered the multiple-choice question
- `full completion`: user answered MC and reflection

Track both.

### `engagement_metrics`

Recommended metrics:

- delivered
- MC replied
- MC correct
- reflection replied
- response time

### `opt_out_rule`

Recommended:

- stop messages if user replies `STOP`
- manually remove user from pilot if needed

### `failure_rule`

Recommended:

- log failed sends
- suppress invalid numbers
- do not repeatedly retry bad numbers
- allow one reminder for non-response

## Notes

- Keep this document short and operational.
- Do not mix content-authoring notes into this file.
- Finalize this before building scheduling or automation logic.
