# Step 3: Data Model Template

Use this document to define the minimum records your micro-PD app needs before you build Cloudflare or Twilio integration.

## Purpose

This document defines:

- what data the app stores
- how lesson content connects to staff
- how assignments are tracked
- how responses are stored
- how engagement is measured

Keep this focused on the MVP. Do not add advanced features unless they are necessary for the first pilot.

## Recommended Core Entities

For the pilot, the app should use these core record types:

- `staff`
- `lessons`
- `lesson_steps`
- `lesson_assignments`
- `responses`
- `message_events`

If you want grouping, add:

- `cohorts`
- `cohort_members`

## Recommended Table Definitions

### `staff`

Stores the people receiving lessons.

Suggested fields:

- `staff_id`
- `first_name`
- `last_name`
- `mobile_phone`
- `role`
- `school`
- `active`
- `pilot_group`
- `opted_out`
- `created_at`
- `updated_at`

### `lessons`

Stores the lesson itself, one row per lesson.

Suggested fields:

- `lesson_slug`
- `lesson_title`
- `staff_target`
- `indicator13_component`
- `instructional_focus`
-`step_order`
-`step_type`
-`response_expected`
-`response_type`
- `status`
- `created_at`
- `updated_at`

Notes:

- `lesson_slug` should be the stable unique ID
- `status` can be `draft`, `ready`, or `archived`

### `lesson_steps`

Stores the steps within each lesson.

Suggested fields:

- `lesson_slug`
- `step_order`
- `step_type`
- `response_expected`
- `response_type`
- `message_text`
- `choice_options`
- `correct_answer`
- `feedback_correct`
- `feedback_incorrect`

Notes:

- the combination of `lesson_slug + step_order` should be unique
- this table should map directly to your lesson spreadsheet

### `lesson_assignments`

Stores which lesson was assigned to which staff member.

Suggested fields:

- `assignment_id`
- `lesson_slug`
- `staff_id`
- `status`
- `scheduled_at`
- `started_at`
- `completed_mc_at`
- `completed_full_at`
- `last_step_sent`
- `last_message_at`
- `reminder_sent_at`
- `created_at`
- `updated_at`

Suggested `status` values:

- `scheduled`
- `in_progress`
- `completed_mc`
- `completed_full`
- `incomplete`
- `opted_out`
- `failed`

### `responses`

Stores replies from staff.

Suggested fields:

- `response_id`
- `assignment_id`
- `lesson_slug`
- `step_order`
- `staff_id`
- `response_type`
- `raw_response`
- `normalized_response`
- `is_correct`
- `quality_score`
- `received_at`

Notes:

- `quality_score` can stay blank for the first pilot if you are not scoring free text yet
- `normalized_response` is useful for MC answers like `a`, `A`, or `choice a`

### `message_events`

Stores outbound and inbound messaging activity.

Suggested fields:

- `message_event_id`
- `assignment_id`
- `lesson_slug`
- `step_order`
- `staff_id`
- `direction`
- `message_body`
- `provider_message_id`
- `delivery_status`
- `sent_at`
- `delivered_at`
- `failed_at`
- `received_at`

Notes:

- `direction` should be `outbound` or `inbound`
- `provider_message_id` will later hold the Twilio SID

## Optional Grouping Tables

### `cohorts`

Stores named pilot groups.

Suggested fields:

- `cohort_id`
- `cohort_name`
- `description`

### `cohort_members`

Links staff to a cohort.

Suggested fields:

- `cohort_id`
- `staff_id`

For a small pilot, you may be able to use `pilot_group` in the `staff` table and skip these extra tables.

## Minimum Relationships

The system should support these relationships:

- one `lesson` has many `lesson_steps`
- one `staff` member can have many `lesson_assignments`
- one `lesson_assignment` can have many `responses`
- one `lesson_assignment` can have many `message_events`

## Recommended MVP Logic

When a lesson is assigned:

1. Create a `lesson_assignment`
2. Set status to `scheduled`
3. At send time, send step 1 and move status to `in_progress`
4. Store each outbound text in `message_events`
5. Store each reply in `responses`
6. Update assignment progress as replies come in
7. Mark `completed_mc_at` after the MC reply
8. Mark `completed_full_at` after the reflection reply

## Engagement Metrics The App Should Be Able To Calculate

From the data above, the app should be able to calculate:

- delivered
- started
- MC replied
- MC correct
- full completion
- response time
- opted out
- failed delivery

## MVP Boundary

Do not add these yet unless they become necessary:

- manager dashboards
- adaptive branching
- AI-generated feedback
- formal rubric scoring
- multiple delivery channels
- badge or certification logic

## Decision For This Step

Before moving on, confirm:

1. whether you want separate `cohort` tables or just a `pilot_group` field
2. whether you want `quality_score` in the MVP or later
3. whether `completed_mc` and `completed_full` should both be tracked

## Next Step

After this document is settled, the next step is:

`Step 4: Message Flow`

That step will define exactly what the app does when a lesson starts, when a user replies, and when reminders are triggered.
