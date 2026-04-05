# Step 5: Build Plan

Use this document to define the implementation order for the micro-PD pilot.

## Purpose

This document turns the planning work into a build sequence.

It should answer:

- what to build first
- what to delay
- how to test safely
- when to connect Cloudflare and Twilio

This is the MVP implementation roadmap.

## Recommended Build Order

Build the pilot in this order:

1. finalize source files
2. create the app schema
3. build CSV import
4. build lesson assignment logic
5. build outbound message flow
6. build inbound reply handling
7. build reminder handling
8. build reporting views
9. connect Twilio
10. run personal test
11. run small live pilot

Do not start with production hosting or broad pilot rollout.

## Phase 1: Finalize Inputs

Before writing app logic, confirm these files are stable:

- `MicroPD_Pilot.csv`
- `roster.csv`
- `pilot_rules_template.md`
- `message_flow_template.md`

At this point, the files do not need to be perfect forever, but they should be stable enough for the first working version.

## Phase 2: Set Up The App Skeleton

Create the basic app project first.

Recommended stack:

- `Cloudflare Worker`
- `D1` database
- minimal admin routes or pages

At the end of this phase, the app should:

- run locally
- connect to a local or dev `D1` database
- expose basic API routes

## Phase 3: Create The Database Schema

Build the tables defined in the data model:

- `staff`
- `lessons`
- `lesson_steps`
- `lesson_assignments`
- `responses`
- `message_events`

Optional later:

- `cohorts`
- `cohort_members`

At the end of this phase, the database should be ready to accept imports.

## Phase 4: Build CSV Import

The first important app feature is import.

Build two imports:

1. lesson import from `MicroPD_Pilot.csv`
2. staff import from `roster.csv`

Recommended import behavior:

- validate required columns
- reject malformed rows
- upsert by stable key
- return a summary of imported rows

Examples:

- lessons keyed by `lesson_slug`
- lesson steps keyed by `lesson_slug + step_order`
- staff keyed by `staff_id`

## Phase 5: Build Lesson Assignment Logic

Build the logic that creates `lesson_assignments`.

Recommended MVP approach:

- assign lessons by `pilot_group`
- create assignments only for active staff
- create one assignment per person per lesson

For the first test, you only need one user: yourself.

## Phase 6: Build Outbound Message Flow

Before connecting Twilio, build the internal logic that decides:

- what step should send next
- when the lesson waits
- when the assignment status changes

The app should be able to simulate:

- concept sent
- MC sent
- waiting for reply
- feedback sent
- explanation sent
- application sent
- reflection sent

This is the point where the message flow becomes real.

## Phase 7: Build Inbound Reply Handling

Build the logic that processes replies.

The app should:

- find the active assignment for the sender
- identify the expected step
- normalize the reply
- score MC replies
- store free-text reflections
- advance the assignment state

This logic should work before production messaging is enabled.

## Phase 8: Build Reminder Logic

Use your pilot rules and message flow rules.

Recommended MVP:

- check for assignments waiting too long for reply
- send one reminder only
- store reminder time

This should be driven by a scheduled Cloudflare job later.

## Phase 9: Build Basic Reporting

You do not need a full dashboard yet.

At minimum, the app should be able to show:

- who received the lesson
- who replied to MC
- who answered correctly
- who submitted reflection
- who completed full lesson
- who failed delivery

This can begin as simple tables or queries.

## Phase 10: Connect Twilio

Only connect Twilio after the internal flow is working.

At this phase:

- create a Twilio number
- add credentials to Cloudflare secrets
- connect outbound send logic
- connect inbound webhook
- connect status callback webhook

Do not begin with a large user set.

## Phase 11: Personal Test

Your first live test should be only with your own number.

Test these scenarios:

- lesson sends on schedule
- MC reply is scored correctly
- invalid MC reply gets the correct response
- reflection reply is stored
- reminder sends correctly
- STOP opt-out works

This is the most important test phase before inviting others.

## Phase 12: Small Pilot Rollout

After personal testing:

- add a very small real test group
- confirm timing feels right
- confirm the number is trusted and messages are not confusing
- confirm reporting matches actual participation

Then expand to the full pilot group.

## What To Delay

Do not build these in the first version unless they become necessary:

- AI reflection scoring
- admin lesson editor
- complex dashboards
- multiple cohorts with different calendars
- multi-channel messaging
- supervisor reports
- branching lessons

## Recommended First Deliverable

The first working deliverable should be:

- import lesson CSV
- import roster CSV
- assign one lesson to one test user
- send lesson
- receive reply
- record result

That is enough to prove the system works.

## Suggested Milestone Checklist

### Milestone 1

- source files finalized
- database schema created
- imports working

### Milestone 2

- lesson assignments created
- outbound flow working
- inbound reply handling working

### Milestone 3

- reminders working
- reporting working
- Twilio connected

### Milestone 4

- personal testing complete
- pilot ready

## Decision For This Step

Before moving on, confirm:

1. whether you want a minimal admin UI in the MVP or import-driven only
2. whether personal testing should use just one lesson first or the full 10-lesson sequence
3. whether reporting can begin as database views/tables instead of a polished dashboard

## Next Step

After this build plan is settled, the next step is:

`Step 6: Technical Setup Checklist`

That step should cover:

- Cloudflare project setup
- D1 creation
- Worker configuration
- Twilio account setup
- secrets and webhook configuration
