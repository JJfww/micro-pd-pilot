import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";

const ROOT = "/Users/jennifer/Desktop/micro-PD";
const LESSONS_CSV = path.join(ROOT, "MicroPD_Pilot.csv");
const ROSTER_CSV = path.join(ROOT, "roster.csv");
const DB_NAME = "micro-pd-pilot";

function parseCsv(content) {
  return parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function normalizeBoolean(value) {
  const normalized = value.trim().toLowerCase();
  return ["true", "yes", "1"].includes(normalized) ? 1 : 0;
}

async function runWrangler(commandArgs) {
  const { spawn } = await import("node:child_process");

  return new Promise((resolve, reject) => {
    const child = spawn("wrangler", commandArgs, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`wrangler ${commandArgs.join(" ")} failed with code ${code}\n${stderr}`));
    });
  });
}

async function executeStatements(statements, remote) {
  for (const statement of statements) {
    const args = ["d1", "execute", DB_NAME];
    if (remote) {
      args.push("--remote");
    } else {
      args.push("--local");
    }
    args.push("--command", statement);
    await runWrangler(args);
  }
}

function sqlValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

async function importLessons(remote) {
  const content = await readFile(LESSONS_CSV, "utf8");
  const rows = parseCsv(content);
  const lessonMap = new Map();

  for (const row of rows) {
    if (!lessonMap.has(row.lesson_slug)) {
      lessonMap.set(row.lesson_slug, {
        lesson_slug: row.lesson_slug,
        lesson_title: row.lesson_title,
        staff_target: row.staff_target,
        indicator13_component: row.indicator13_component,
        instructional_focus: row.instructional_focus,
      });
    }
  }

  const statements = [
    "DELETE FROM lesson_steps;",
    "DELETE FROM lessons;",
  ];

  for (const lesson of lessonMap.values()) {
    statements.push(`
      INSERT INTO lessons (
        lesson_slug, lesson_title, staff_target, indicator13_component, instructional_focus, status
      ) VALUES (
        ${sqlValue(lesson.lesson_slug)},
        ${sqlValue(lesson.lesson_title)},
        ${sqlValue(lesson.staff_target)},
        ${sqlValue(lesson.indicator13_component)},
        ${sqlValue(lesson.instructional_focus)},
        'ready'
      );
    `.trim());
  }

  for (const row of rows) {
    statements.push(`
      INSERT INTO lesson_steps (
        lesson_slug, step_order, step_type, response_expected, response_type, message_text,
        choice_options, correct_answer, feedback_correct, feedback_incorrect
      ) VALUES (
        ${sqlValue(row.lesson_slug)},
        ${Number.parseInt(row.step_order, 10)},
        ${sqlValue(row.step_type)},
        ${normalizeBoolean(row.response_expected)},
        ${sqlValue(row.response_type || "none")},
        ${sqlValue(row.message_text)},
        ${sqlValue(row.choice_options || null)},
        ${sqlValue(row.correct_answer || null)},
        ${sqlValue(row.feedback_correct || null)},
        ${sqlValue(row.feedback_incorrect || null)}
      );
    `.trim());
  }

  await executeStatements(statements, remote);

  return {
    lessonCount: lessonMap.size,
    stepCount: rows.length,
  };
}

async function importRoster(remote) {
  const content = await readFile(ROSTER_CSV, "utf8");
  const rows = parseCsv(content);

  const validRows = rows.filter((row) => row.staff_id && row.mobile_phone);
  const statements = [];

  for (const row of validRows) {
    statements.push(`
      INSERT INTO staff (
        staff_id, first_name, last_name, mobile_phone, role, school, active, pilot_group, opted_out
      ) VALUES (
        ${sqlValue(row.staff_id)},
        ${sqlValue(row.first_name || "Unknown")},
        ${sqlValue(row.last_name || "Unknown")},
        ${sqlValue(row.mobile_phone)},
        ${sqlValue(row.role || null)},
        ${sqlValue(row.school || null)},
        ${normalizeBoolean(row.active)},
        ${sqlValue(row.pilot_group || null)},
        0
      )
      ON CONFLICT(staff_id) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        mobile_phone = excluded.mobile_phone,
        role = excluded.role,
        school = excluded.school,
        active = excluded.active,
        pilot_group = excluded.pilot_group,
        updated_at = CURRENT_TIMESTAMP;
    `.trim());
  }

  await executeStatements(statements, remote);

  return {
    rowCount: rows.length,
    importedCount: validRows.length,
    skippedCount: rows.length - validRows.length,
  };
}

async function main() {
  const remote = process.argv.includes("--remote");
  const local = process.argv.includes("--local");
  const rosterOnly = process.argv.includes("--roster-only");
  const lessonsOnly = process.argv.includes("--lessons-only");

  if (!remote && !local) {
    throw new Error("Pass either --local or --remote.");
  }

  if (rosterOnly && lessonsOnly) {
    throw new Error("Use only one of --roster-only or --lessons-only.");
  }

  let lessonSummary = null;
  let rosterSummary = null;

  if (!rosterOnly) {
    lessonSummary = await importLessons(remote);
  }

  if (!lessonsOnly) {
    rosterSummary = await importRoster(remote);
  }

  console.log(
    JSON.stringify(
      {
        target: remote ? "remote" : "local",
        lessons: lessonSummary,
        roster: rosterSummary,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
