export interface Env {
  DB: D1Database;
  APP_NAME: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  SCHEDULER_TIMEZONE: string;
  SCHEDULER_SEND_DAYS: string;
  SCHEDULER_SEND_HOUR: string;
  SCHEDULER_SEND_MINUTE: string;
  DEFAULT_PILOT_GROUP: string;
}

type CountRow = {
  count: number;
};

type LessonRow = {
  lesson_slug: string;
  lesson_title: string;
  staff_target: string | null;
  indicator13_component: string | null;
  instructional_focus: string | null;
  status: string;
};

type StaffRow = {
  staff_id: string;
  first_name: string;
  last_name: string;
  mobile_phone: string;
  role: string | null;
  school: string | null;
  active: number;
  pilot_group: string | null;
  opted_out: number;
};

type AssignmentRow = {
  assignment_id: string;
  lesson_slug: string;
  lesson_title: string;
  staff_id: string;
  staff_name: string;
  staff_phone?: string;
  status: string;
  scheduled_at: string;
  started_at: string | null;
  completed_mc_at: string | null;
  completed_full_at: string | null;
  last_step_sent: number | null;
  last_message_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type StepRow = {
  lesson_slug: string;
  step_order: number;
  step_type: string;
  response_expected: number;
  response_type: string;
  message_text: string;
  choice_options: string | null;
  correct_answer: string | null;
  feedback_correct: string | null;
  feedback_incorrect: string | null;
};

type MessageSendResult = {
  sid: string;
  status: string;
};

async function listTableNames(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all<{ name: string }>();

  return result.results.map((row) => row.name);
}

async function getTableCount(db: D1Database, tableName: string): Promise<number> {
  const result = await db
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
    .first<CountRow>();

  return result?.count ?? 0;
}

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: message }, status);
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRole(role: string | null): string {
  return (role ?? "").trim().toLowerCase();
}

function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getLocalTimeParts(date: Date, timezone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const entries = parts
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value] as const);

  return Object.fromEntries(entries);
}

function isScheduledSendTime(env: Env, date: Date): boolean {
  const timezone = env.SCHEDULER_TIMEZONE || "America/Chicago";
  const sendDays = parseCsvList(env.SCHEDULER_SEND_DAYS || "Monday,Wednesday");
  const sendHour = Number.parseInt(env.SCHEDULER_SEND_HOUR || "14", 10);
  const sendMinute = Number.parseInt(env.SCHEDULER_SEND_MINUTE || "25", 10);
  const local = getLocalTimeParts(date, timezone);
  const hour = Number.parseInt(local.hour ?? "-1", 10);
  const minute = Number.parseInt(local.minute ?? "-1", 10);

  return sendDays.includes(local.weekday ?? "") && hour === sendHour && minute === sendMinute;
}

function mapRoleToTargets(role: string | null): Set<string> {
  const normalizedRole = normalizeRole(role);
  const targets = new Set<string>();

  if (
    normalizedRole.includes("teacher") ||
    normalizedRole === "transition_specialist" ||
    normalizedRole === "social_worker"
  ) {
    targets.add("Teacher");
    targets.add("Teacher/Para");
  }

  if (normalizedRole.includes("para")) {
    targets.add("Teacher/Para");
  }

  return targets;
}

function staffMatchesLessonTarget(staff: StaffRow, lesson: LessonRow): boolean {
  if ((staff.pilot_group ?? "").trim().toLowerCase() === "test") {
    return true;
  }

  if (!lesson.staff_target) {
    return true;
  }

  return mapRoleToTargets(staff.role).has(lesson.staff_target);
}

function normalizeMcResponse(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  const match = trimmed.match(/\b([ABC])\b/);
  return match?.[1] ?? null;
}

function isStopWord(input: string): boolean {
  return ["STOP", "UNSUBSCRIBE", "QUIT"].includes(input.trim().toUpperCase());
}

async function listLessons(db: D1Database): Promise<LessonRow[]> {
  const result = await db
    .prepare(
      `SELECT lesson_slug, lesson_title, staff_target, indicator13_component, instructional_focus, status
       FROM lessons
       ORDER BY rowid`
    )
    .all<LessonRow>();

  return result.results;
}

async function listActiveStaff(db: D1Database, pilotGroup?: string | null): Promise<StaffRow[]> {
  const baseQuery = `SELECT staff_id, first_name, last_name, mobile_phone, role, school, active, pilot_group, opted_out
     FROM staff
     WHERE active = 1 AND opted_out = 0`;

  if (pilotGroup) {
    const result = await db
      .prepare(`${baseQuery} AND pilot_group = ?1 ORDER BY last_name, first_name`)
      .bind(pilotGroup)
      .all<StaffRow>();
    return result.results;
  }

  const result = await db.prepare(`${baseQuery} ORDER BY last_name, first_name`).all<StaffRow>();
  return result.results;
}

async function getLessonBySlug(db: D1Database, lessonSlug: string): Promise<LessonRow | null> {
  return (
    (await db
      .prepare(
        `SELECT lesson_slug, lesson_title, staff_target, indicator13_component, instructional_focus, status
         FROM lessons
         WHERE lesson_slug = ?1`
      )
      .bind(lessonSlug)
      .first<LessonRow>()) ?? null
  );
}

async function getStaffById(db: D1Database, staffId: string): Promise<StaffRow | null> {
  return (
    (await db
      .prepare(
        `SELECT staff_id, first_name, last_name, mobile_phone, role, school, active, pilot_group, opted_out
         FROM staff
         WHERE staff_id = ?1`
      )
      .bind(staffId)
      .first<StaffRow>()) ?? null
  );
}

async function getStaffByPhone(db: D1Database, phoneNumber: string): Promise<StaffRow | null> {
  return (
    (await db
      .prepare(
        `SELECT staff_id, first_name, last_name, mobile_phone, role, school, active, pilot_group, opted_out
         FROM staff
         WHERE mobile_phone = ?1`
      )
      .bind(phoneNumber)
      .first<StaffRow>()) ?? null
  );
}

async function getLessonSteps(db: D1Database, lessonSlug: string): Promise<StepRow[]> {
  const result = await db
    .prepare(
      `SELECT lesson_slug, step_order, step_type, response_expected, response_type, message_text,
              choice_options, correct_answer, feedback_correct, feedback_incorrect
       FROM lesson_steps
       WHERE lesson_slug = ?1
       ORDER BY step_order`
    )
    .bind(lessonSlug)
    .all<StepRow>();

  return result.results;
}

async function createAssignment(
  db: D1Database,
  staffId: string,
  lessonSlug: string,
  scheduledAt: string
): Promise<string> {
  const assignmentId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO lesson_assignments (
         assignment_id, lesson_slug, staff_id, status, scheduled_at
       ) VALUES (?1, ?2, ?3, 'scheduled', ?4)`
    )
    .bind(assignmentId, lessonSlug, staffId, scheduledAt)
    .run();

  return assignmentId;
}

async function listAssignments(db: D1Database, staffId?: string | null): Promise<AssignmentRow[]> {
  const baseQuery = `
    SELECT
      la.assignment_id,
      la.lesson_slug,
      l.lesson_title,
      la.staff_id,
      s.first_name || ' ' || s.last_name AS staff_name,
      s.mobile_phone AS staff_phone,
      la.status,
      la.scheduled_at,
      la.started_at,
      la.completed_mc_at,
      la.completed_full_at,
      la.last_step_sent,
      la.last_message_at,
      la.reminder_sent_at,
      la.created_at,
      la.updated_at
    FROM lesson_assignments la
    INNER JOIN lessons l ON l.lesson_slug = la.lesson_slug
    INNER JOIN staff s ON s.staff_id = la.staff_id
  `;

  if (staffId) {
    const result = await db
      .prepare(`${baseQuery} WHERE la.staff_id = ?1 ORDER BY la.created_at DESC`)
      .bind(staffId)
      .all<AssignmentRow>();
    return result.results;
  }

  const result = await db
    .prepare(`${baseQuery} ORDER BY la.created_at DESC`)
    .all<AssignmentRow>();
  return result.results;
}

async function getAssignment(db: D1Database, assignmentId: string): Promise<AssignmentRow | null> {
  return (
    (await db
      .prepare(
        `SELECT
           la.assignment_id,
           la.lesson_slug,
           l.lesson_title,
           la.staff_id,
           s.first_name || ' ' || s.last_name AS staff_name,
           s.mobile_phone AS staff_phone,
           la.status,
           la.scheduled_at,
           la.started_at,
           la.completed_mc_at,
           la.completed_full_at,
           la.last_step_sent,
           la.last_message_at,
           la.reminder_sent_at,
           la.created_at,
           la.updated_at
         FROM lesson_assignments la
         INNER JOIN lessons l ON l.lesson_slug = la.lesson_slug
         INNER JOIN staff s ON s.staff_id = la.staff_id
         WHERE la.assignment_id = ?1`
      )
      .bind(assignmentId)
      .first<AssignmentRow>()) ?? null
  );
}

async function getActiveAssignmentForPhone(
  db: D1Database,
  phoneNumber: string
): Promise<AssignmentRow | null> {
  return (
    (await db
      .prepare(
        `SELECT
           la.assignment_id,
           la.lesson_slug,
           l.lesson_title,
           la.staff_id,
           s.first_name || ' ' || s.last_name AS staff_name,
           s.mobile_phone AS staff_phone,
           la.status,
           la.scheduled_at,
           la.started_at,
           la.completed_mc_at,
           la.completed_full_at,
           la.last_step_sent,
           la.last_message_at,
           la.reminder_sent_at,
           la.created_at,
           la.updated_at
         FROM lesson_assignments la
         INNER JOIN lessons l ON l.lesson_slug = la.lesson_slug
         INNER JOIN staff s ON s.staff_id = la.staff_id
         WHERE s.mobile_phone = ?1
           AND la.status IN ('waiting_for_mc', 'waiting_for_reflection')
         ORDER BY la.updated_at DESC
         LIMIT 1`
      )
      .bind(phoneNumber)
      .first<AssignmentRow>()) ?? null
  );
}

async function getOpenAssignmentForStaff(
  db: D1Database,
  staffId: string
): Promise<AssignmentRow | null> {
  return (
    (await db
      .prepare(
        `SELECT
           la.assignment_id,
           la.lesson_slug,
           l.lesson_title,
           la.staff_id,
           s.first_name || ' ' || s.last_name AS staff_name,
           s.mobile_phone AS staff_phone,
           la.status,
           la.scheduled_at,
           la.started_at,
           la.completed_mc_at,
           la.completed_full_at,
           la.last_step_sent,
           la.last_message_at,
           la.reminder_sent_at,
           la.created_at,
           la.updated_at
         FROM lesson_assignments la
         INNER JOIN lessons l ON l.lesson_slug = la.lesson_slug
         INNER JOIN staff s ON s.staff_id = la.staff_id
         WHERE la.staff_id = ?1
           AND la.status IN ('scheduled', 'waiting_for_mc', 'waiting_for_reflection')
         ORDER BY la.created_at DESC
         LIMIT 1`
      )
      .bind(staffId)
      .first<AssignmentRow>()) ?? null
  );
}

async function listAssignedLessonSlugsForStaff(db: D1Database, staffId: string): Promise<Set<string>> {
  const result = await db
    .prepare(
      `SELECT DISTINCT lesson_slug
       FROM lesson_assignments
       WHERE staff_id = ?1`
    )
    .bind(staffId)
    .all<{ lesson_slug: string }>();

  return new Set(result.results.map((row) => row.lesson_slug));
}

async function updateAssignmentAfterStart(
  db: D1Database,
  assignmentId: string,
  lastStepSent: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE lesson_assignments
       SET status = 'waiting_for_mc',
           started_at = COALESCE(started_at, ?2),
           last_step_sent = ?3,
           last_message_at = ?2,
           updated_at = ?2
       WHERE assignment_id = ?1`
    )
    .bind(assignmentId, nowIso(), lastStepSent)
    .run();
}

async function updateAssignmentAfterMc(
  db: D1Database,
  assignmentId: string,
  lastStepSent: number
): Promise<void> {
  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE lesson_assignments
       SET status = 'waiting_for_reflection',
           completed_mc_at = ?2,
           last_step_sent = ?3,
           last_message_at = ?2,
           updated_at = ?2
       WHERE assignment_id = ?1`
    )
    .bind(assignmentId, timestamp, lastStepSent)
    .run();
}

async function completeAssignment(db: D1Database, assignmentId: string): Promise<void> {
  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE lesson_assignments
       SET status = 'completed_full',
           completed_full_at = ?2,
           last_message_at = ?2,
           updated_at = ?2
       WHERE assignment_id = ?1`
    )
    .bind(assignmentId, timestamp)
    .run();
}

async function markOptedOut(db: D1Database, staffId: string, assignmentId: string): Promise<void> {
  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE staff
       SET opted_out = 1, updated_at = ?2
       WHERE staff_id = ?1`
    )
    .bind(staffId, timestamp)
    .run();

  await db
    .prepare(
      `UPDATE lesson_assignments
       SET status = 'opted_out', updated_at = ?2
       WHERE assignment_id = ?1`
    )
    .bind(assignmentId, timestamp)
    .run();
}

async function createResponse(
  db: D1Database,
  assignment: AssignmentRow,
  stepOrder: number,
  responseType: string,
  rawResponse: string,
  normalizedResponse: string | null,
  isCorrect: number | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO responses (
         response_id, assignment_id, lesson_slug, step_order, staff_id, response_type,
         raw_response, normalized_response, is_correct
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
    .bind(
      crypto.randomUUID(),
      assignment.assignment_id,
      assignment.lesson_slug,
      stepOrder,
      assignment.staff_id,
      responseType,
      rawResponse,
      normalizedResponse,
      isCorrect
    )
    .run();
}

async function recordMessageEvent(
  db: D1Database,
  params: {
    assignmentId?: string | null;
    lessonSlug?: string | null;
    stepOrder?: number | null;
    staffId?: string | null;
    direction: "outbound" | "inbound";
    messageBody: string;
    providerMessageId?: string | null;
    deliveryStatus?: string | null;
    sentAt?: string | null;
    receivedAt?: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO message_events (
         message_event_id, assignment_id, lesson_slug, step_order, staff_id, direction,
         message_body, provider_message_id, delivery_status, sent_at, received_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
    .bind(
      crypto.randomUUID(),
      params.assignmentId ?? null,
      params.lessonSlug ?? null,
      params.stepOrder ?? null,
      params.staffId ?? null,
      params.direction,
      params.messageBody,
      params.providerMessageId ?? null,
      params.deliveryStatus ?? null,
      params.sentAt ?? null,
      params.receivedAt ?? null
    )
    .run();
}

async function updateMessageEventStatus(
  db: D1Database,
  providerMessageId: string,
  status: string
): Promise<void> {
  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE message_events
       SET delivery_status = ?2,
           delivered_at = CASE WHEN ?2 = 'delivered' THEN ?3 ELSE delivered_at END,
           failed_at = CASE WHEN ?2 IN ('failed', 'undelivered') THEN ?3 ELSE failed_at END
       WHERE provider_message_id = ?1`
    )
    .bind(providerMessageId, status, timestamp)
    .run();
}

async function sendSms(
  env: Env,
  to: string,
  body: string,
  statusCallbackUrl?: string
): Promise<MessageSendResult> {
  const credentials = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", env.TWILIO_PHONE_NUMBER);
  form.set("Body", body);
  if (statusCallbackUrl) {
    form.set("StatusCallback", statusCallbackUrl);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twilio send failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as { sid: string; status: string };
  return {
    sid: payload.sid,
    status: payload.status,
  };
}

async function sendStepMessage(
  db: D1Database,
  env: Env,
  requestUrl: string | null,
  assignment: AssignmentRow,
  stepOrder: number,
  messageBody: string
): Promise<void> {
  const statusCallbackUrl = requestUrl
    ? `${new URL(requestUrl).origin}/webhooks/twilio/status`
    : undefined;
  const result = await sendSms(env, assignment.staff_phone!, messageBody, statusCallbackUrl);
  const timestamp = nowIso();

  await recordMessageEvent(db, {
    assignmentId: assignment.assignment_id,
    lessonSlug: assignment.lesson_slug,
    stepOrder,
    staffId: assignment.staff_id,
    direction: "outbound",
    messageBody,
    providerMessageId: result.sid,
    deliveryStatus: result.status,
    sentAt: timestamp,
  });
}

async function startAssignment(
  db: D1Database,
  env: Env,
  requestUrl: string | null,
  assignmentId: string
): Promise<{ assignment: AssignmentRow; sentSteps: number[] }> {
  const assignment = await getAssignment(db, assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found.");
  }

  if (!assignment.staff_phone) {
    throw new Error("Assignment staff member does not have a mobile phone.");
  }

  const steps = await getLessonSteps(db, assignment.lesson_slug);
  const conceptStep = steps.find((step) => step.step_type === "concept");
  const mcStep = steps.find((step) => step.step_type === "check_understanding");

  if (!conceptStep || !mcStep) {
    throw new Error("Lesson is missing concept or check_understanding step.");
  }

  await sendStepMessage(db, env, requestUrl, assignment, conceptStep.step_order, conceptStep.message_text);
  await sendStepMessage(
    db,
    env,
    requestUrl,
    assignment,
    mcStep.step_order,
    `${mcStep.message_text} ${mcStep.choice_options ?? ""}`.trim()
  );

  await updateAssignmentAfterStart(db, assignment.assignment_id, mcStep.step_order);
  const updatedAssignment = await getAssignment(db, assignment.assignment_id);

  if (!updatedAssignment) {
    throw new Error("Assignment disappeared after start.");
  }

  return {
    assignment: updatedAssignment,
    sentSteps: [conceptStep.step_order, mcStep.step_order],
  };
}

async function processInboundReply(
  db: D1Database,
  env: Env,
  requestUrl: string,
  from: string,
  body: string,
  providerMessageId: string | null
): Promise<Response> {
  const staff = await getStaffByPhone(db, from);
  if (!staff) {
    return errorResponse("Unknown sender phone number.", 404);
  }

  const assignment = await getActiveAssignmentForPhone(db, from);
  if (!assignment) {
    await recordMessageEvent(db, {
      staffId: staff.staff_id,
      direction: "inbound",
      messageBody: body,
      providerMessageId,
      receivedAt: nowIso(),
    });
    return jsonResponse({ ok: true, status: "ignored_no_active_assignment" });
  }

  if (isStopWord(body)) {
    await recordMessageEvent(db, {
      assignmentId: assignment.assignment_id,
      lessonSlug: assignment.lesson_slug,
      staffId: assignment.staff_id,
      direction: "inbound",
      messageBody: body,
      providerMessageId,
      receivedAt: nowIso(),
    });
    await markOptedOut(db, assignment.staff_id, assignment.assignment_id);
    return jsonResponse({ ok: true, status: "opted_out" });
  }

  const steps = await getLessonSteps(db, assignment.lesson_slug);

  if (assignment.status === "waiting_for_mc") {
    const mcStep = steps.find((step) => step.step_type === "check_understanding");
    const explanationStep = steps.find((step) => step.step_type === "explanation");
    const applicationStep = steps.find((step) => step.step_type === "application");
    const reflectionStep = steps.find((step) => step.step_type === "reflection");

    if (!mcStep || !explanationStep || !applicationStep || !reflectionStep) {
      return errorResponse("Lesson is missing one or more required steps.", 500);
    }

    const normalized = normalizeMcResponse(body);
    await recordMessageEvent(db, {
      assignmentId: assignment.assignment_id,
      lessonSlug: assignment.lesson_slug,
      stepOrder: mcStep.step_order,
      staffId: assignment.staff_id,
      direction: "inbound",
      messageBody: body,
      providerMessageId,
      receivedAt: nowIso(),
    });

    if (!normalized) {
      await createResponse(
        db,
        assignment,
        mcStep.step_order,
        mcStep.response_type,
        body,
        null,
        null
      );
      return jsonResponse({ ok: true, status: "ignored_invalid_mc_reply" });
    }

    const isCorrect = normalized === (mcStep.correct_answer ?? "").toUpperCase();
    await createResponse(
      db,
      assignment,
      mcStep.step_order,
      mcStep.response_type,
      body,
      normalized,
      isCorrect ? 1 : 0
    );

    await sendStepMessage(
      db,
      env,
      requestUrl,
      assignment,
      mcStep.step_order,
      isCorrect ? mcStep.feedback_correct ?? "Correct." : mcStep.feedback_incorrect ?? "Incorrect."
    );
    await sendStepMessage(
      db,
      env,
      requestUrl,
      assignment,
      explanationStep.step_order,
      explanationStep.message_text
    );
    await sendStepMessage(
      db,
      env,
      requestUrl,
      assignment,
      applicationStep.step_order,
      applicationStep.message_text
    );
    await sendStepMessage(
      db,
      env,
      requestUrl,
      assignment,
      reflectionStep.step_order,
      reflectionStep.message_text
    );

    await updateAssignmentAfterMc(db, assignment.assignment_id, reflectionStep.step_order);
    return jsonResponse({
      ok: true,
      status: "processed_mc_reply",
      is_correct: isCorrect,
    });
  }

  if (assignment.status === "waiting_for_reflection") {
    const reflectionStep = steps.find((step) => step.step_type === "reflection");
    if (!reflectionStep) {
      return errorResponse("Lesson is missing reflection step.", 500);
    }

    await recordMessageEvent(db, {
      assignmentId: assignment.assignment_id,
      lessonSlug: assignment.lesson_slug,
      stepOrder: reflectionStep.step_order,
      staffId: assignment.staff_id,
      direction: "inbound",
      messageBody: body,
      providerMessageId,
      receivedAt: nowIso(),
    });
    await createResponse(
      db,
      assignment,
      reflectionStep.step_order,
      reflectionStep.response_type,
      body,
      null,
      null
    );
    await completeAssignment(db, assignment.assignment_id);
    return jsonResponse({ ok: true, status: "completed_full" });
  }

  return jsonResponse({ ok: true, status: "ignored_unhandled_assignment_state" });
}

async function runScheduledLessonDispatch(env: Env, requestUrl: string | null): Promise<{
  ok: true;
  dispatched_at: string;
  pilot_group: string;
  started_assignment_ids: string[];
  skipped_staff: Array<{ staff_id: string; reason: string }>;
}> {
  const pilotGroup = env.DEFAULT_PILOT_GROUP || "cohort_1";
  const staffMembers = await listActiveStaff(env.DB, pilotGroup);
  const lessons = await listLessons(env.DB);
  const startedAssignmentIds: string[] = [];
  const skippedStaff: Array<{ staff_id: string; reason: string }> = [];

  for (const staff of staffMembers) {
    const openAssignment = await getOpenAssignmentForStaff(env.DB, staff.staff_id);
    if (openAssignment) {
      skippedStaff.push({ staff_id: staff.staff_id, reason: "open_assignment_exists" });
      continue;
    }

    const assignedLessonSlugs = await listAssignedLessonSlugsForStaff(env.DB, staff.staff_id);
    const nextLesson = lessons.find(
      (lesson) => !assignedLessonSlugs.has(lesson.lesson_slug) && staffMatchesLessonTarget(staff, lesson)
    );

    if (!nextLesson) {
      skippedStaff.push({ staff_id: staff.staff_id, reason: "no_matching_unassigned_lesson" });
      continue;
    }

    const assignmentId = await createAssignment(env.DB, staff.staff_id, nextLesson.lesson_slug, nowIso());
    await startAssignment(env.DB, env, requestUrl, assignmentId);
    startedAssignmentIds.push(assignmentId);
  }

  return {
    ok: true,
    dispatched_at: nowIso(),
    pilot_group: pilotGroup,
    started_assignment_ids: startedAssignmentIds,
    skipped_staff: skippedStaff,
  };
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        app: env.APP_NAME,
        twilioConfigured: Boolean(
          env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER
        ),
      });
    }

    if (url.pathname === "/db/health") {
      const tables = await listTableNames(env.DB);
      const counts = Object.fromEntries(
        await Promise.all(
          ["staff", "lessons", "lesson_steps", "lesson_assignments", "responses", "message_events"].map(
            async (tableName) => [tableName, await getTableCount(env.DB, tableName)] as const
          )
        )
      );

      return jsonResponse({
        ok: true,
        app: env.APP_NAME,
        tables,
        counts,
      });
    }

    if (url.pathname === "/admin/lessons" && request.method === "GET") {
      return jsonResponse({ ok: true, lessons: await listLessons(env.DB) });
    }

    if (url.pathname === "/admin/staff" && request.method === "GET") {
      const pilotGroup = url.searchParams.get("pilot_group");
      return jsonResponse({ ok: true, staff: await listActiveStaff(env.DB, pilotGroup) });
    }

    if (url.pathname === "/admin/assignments" && request.method === "GET") {
      const staffId = url.searchParams.get("staff_id");
      return jsonResponse({ ok: true, assignments: await listAssignments(env.DB, staffId) });
    }

    if (url.pathname === "/admin/scheduler/preview" && request.method === "GET") {
      const pilotGroup = url.searchParams.get("pilot_group") ?? env.DEFAULT_PILOT_GROUP ?? "cohort_1";
      const staffMembers = await listActiveStaff(env.DB, pilotGroup);
      const lessons = await listLessons(env.DB);
      const preview = [];

      for (const staff of staffMembers) {
        const openAssignment = await getOpenAssignmentForStaff(env.DB, staff.staff_id);
        const assignedLessonSlugs = await listAssignedLessonSlugsForStaff(env.DB, staff.staff_id);
        const nextLesson = lessons.find(
          (lesson) =>
            !assignedLessonSlugs.has(lesson.lesson_slug) && staffMatchesLessonTarget(staff, lesson)
        );

        preview.push({
          staff_id: staff.staff_id,
          staff_name: `${staff.first_name} ${staff.last_name}`,
          role: staff.role,
          pilot_group: staff.pilot_group,
          open_assignment: openAssignment
            ? {
                assignment_id: openAssignment.assignment_id,
                lesson_slug: openAssignment.lesson_slug,
                status: openAssignment.status,
              }
            : null,
          next_lesson: nextLesson
            ? {
                lesson_slug: nextLesson.lesson_slug,
                lesson_title: nextLesson.lesson_title,
                staff_target: nextLesson.staff_target,
              }
            : null,
        });
      }

      return jsonResponse({
        ok: true,
        scheduler: {
          timezone: env.SCHEDULER_TIMEZONE,
          send_days: env.SCHEDULER_SEND_DAYS,
          send_hour: env.SCHEDULER_SEND_HOUR,
          send_minute: env.SCHEDULER_SEND_MINUTE,
          pilot_group: pilotGroup,
        },
        preview,
      });
    }

    if (url.pathname === "/admin/assignments" && request.method === "POST") {
      const body = (await request.json()) as {
        lesson_slug?: string;
        staff_id?: string;
        scheduled_at?: string;
      };

      if (!body.lesson_slug || !body.staff_id) {
        return errorResponse("lesson_slug and staff_id are required.");
      }

      const lesson = await getLessonBySlug(env.DB, body.lesson_slug);
      if (!lesson) {
        return errorResponse(`Lesson not found: ${body.lesson_slug}`, 404);
      }

      const staff = await getStaffById(env.DB, body.staff_id);
      if (!staff || staff.active !== 1 || staff.opted_out !== 0) {
        return errorResponse(`Active staff member not found: ${body.staff_id}`, 404);
      }

      const assignmentId = await createAssignment(
        env.DB,
        body.staff_id,
        body.lesson_slug,
        body.scheduled_at ?? nowIso()
      );

      return jsonResponse(
        {
          ok: true,
          assignment: await getAssignment(env.DB, assignmentId),
          step_count: (await getLessonSteps(env.DB, body.lesson_slug)).length,
        },
        201
      );
    }

    const assignmentMatch = url.pathname.match(/^\/admin\/assignments\/([^/]+)$/);
    if (assignmentMatch && request.method === "GET") {
      const assignment = await getAssignment(env.DB, assignmentMatch[1]);
      if (!assignment) {
        return errorResponse("Assignment not found.", 404);
      }

      return jsonResponse({
        ok: true,
        assignment,
        steps: await getLessonSteps(env.DB, assignment.lesson_slug),
      });
    }

    const startMatch = url.pathname.match(/^\/admin\/assignments\/([^/]+)\/start$/);
    if (startMatch && request.method === "POST") {
      try {
        const result = await startAssignment(env.DB, env, request.url, startMatch[1]);
        return jsonResponse({ ok: true, ...result });
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "Failed to start assignment.", 500);
      }
    }

    if (url.pathname === "/webhooks/twilio/inbound" && request.method === "POST") {
      const form = await request.formData();
      const from = form.get("From")?.toString() ?? "";
      const body = form.get("Body")?.toString() ?? "";
      const providerMessageId = form.get("MessageSid")?.toString() ?? null;

      if (!from || !body) {
        return errorResponse("Missing From or Body.", 400);
      }

      return processInboundReply(env.DB, env, request.url, from, body, providerMessageId);
    }

    if (url.pathname === "/webhooks/twilio/status" && request.method === "POST") {
      const form = await request.formData();
      const messageSid = form.get("MessageSid")?.toString() ?? "";
      const messageStatus = form.get("MessageStatus")?.toString() ?? "";

      if (messageSid && messageStatus) {
        await updateMessageEventStatus(env.DB, messageSid, messageStatus);
      }

      return new Response("ok", { status: 200 });
    }

    return jsonResponse(
      {
        ok: true,
        app: env.APP_NAME,
        message: "micro-PD Worker is running",
      },
      200
    );
  },
  async scheduled(controller, env, ctx): Promise<void> {
    if (!isScheduledSendTime(env, new Date(controller.scheduledTime))) {
      return;
    }

    ctx.waitUntil(runScheduledLessonDispatch(env, null));
  },
} satisfies ExportedHandler<Env>;
