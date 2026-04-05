CREATE TABLE IF NOT EXISTS staff (
  staff_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  mobile_phone TEXT NOT NULL,
  role TEXT,
  school TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  pilot_group TEXT,
  opted_out INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
  lesson_slug TEXT PRIMARY KEY,
  lesson_title TEXT NOT NULL,
  staff_target TEXT,
  indicator13_component TEXT,
  instructional_focus TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lesson_steps (
  lesson_slug TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  response_expected INTEGER NOT NULL DEFAULT 0,
  response_type TEXT NOT NULL DEFAULT 'none',
  message_text TEXT NOT NULL,
  choice_options TEXT,
  correct_answer TEXT,
  feedback_correct TEXT,
  feedback_incorrect TEXT,
  PRIMARY KEY (lesson_slug, step_order),
  FOREIGN KEY (lesson_slug) REFERENCES lessons(lesson_slug)
);

CREATE TABLE IF NOT EXISTS lesson_assignments (
  assignment_id TEXT PRIMARY KEY,
  lesson_slug TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at TEXT NOT NULL,
  started_at TEXT,
  completed_mc_at TEXT,
  completed_full_at TEXT,
  last_step_sent INTEGER,
  last_message_at TEXT,
  reminder_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_slug) REFERENCES lessons(lesson_slug),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS responses (
  response_id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  lesson_slug TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  staff_id TEXT NOT NULL,
  response_type TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  normalized_response TEXT,
  is_correct INTEGER,
  quality_score REAL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES lesson_assignments(assignment_id),
  FOREIGN KEY (lesson_slug, step_order) REFERENCES lesson_steps(lesson_slug, step_order),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS message_events (
  message_event_id TEXT PRIMARY KEY,
  assignment_id TEXT,
  lesson_slug TEXT,
  step_order INTEGER,
  staff_id TEXT,
  direction TEXT NOT NULL,
  message_body TEXT NOT NULL,
  provider_message_id TEXT,
  delivery_status TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  failed_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES lesson_assignments(assignment_id),
  FOREIGN KEY (lesson_slug, step_order) REFERENCES lesson_steps(lesson_slug, step_order),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_pilot_group ON staff (pilot_group);
CREATE INDEX IF NOT EXISTS idx_assignments_staff_status ON lesson_assignments (staff_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_scheduled_at ON lesson_assignments (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_responses_assignment ON responses (assignment_id);
CREATE INDEX IF NOT EXISTS idx_message_events_assignment ON message_events (assignment_id);
