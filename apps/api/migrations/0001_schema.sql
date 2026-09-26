CREATE TYPE "app"."account_status" AS ENUM('pending', 'active', 'suspended', 'disabled', 'pending_deletion');--> statement-breakpoint
CREATE TYPE "app"."client_kind" AS ENUM('web', 'mobile');--> statement-breakpoint
CREATE TYPE "app"."file_lifecycle" AS ENUM('upload_pending', 'quarantine', 'available', 'rejected', 'deleted');--> statement-breakpoint
CREATE TYPE "app"."file_purpose" AS ENUM('homework_attachment', 'submission', 'material', 'profile_image', 'document', 'announcement_attachment', 'import', 'export', 'report');--> statement-breakpoint
CREATE TYPE "app"."file_scan_state" AS ENUM('pending', 'clean', 'infected', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "app"."locale" AS ENUM('en', 'ur');--> statement-breakpoint
CREATE TYPE "app"."provisioning_state" AS ENUM('pending', 'provisioning', 'provisioned', 'failed');--> statement-breakpoint
CREATE TYPE "app"."role" AS ENUM('school_admin', 'teacher', 'student');--> statement-breakpoint
CREATE TYPE "app"."school_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "app"."employment_status" AS ENUM('active', 'on_leave', 'ended');--> statement-breakpoint
CREATE TYPE "app"."gender" AS ENUM('female', 'male', 'other');--> statement-breakpoint
CREATE TYPE "app"."academic_year_status" AS ENUM('planning', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "app"."calendar_day_kind" AS ENUM('instructional', 'holiday', 'closure', 'exam', 'event');--> statement-breakpoint
CREATE TYPE "app"."course_enrollment_status" AS ENUM('active', 'dropped', 'completed');--> statement-breakpoint
CREATE TYPE "app"."curriculum_state" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "app"."enrollment_status" AS ENUM('active', 'withdrawn', 'transferred', 'completed');--> statement-breakpoint
CREATE TYPE "app"."placement_reason" AS ENUM('admission', 'transfer', 'promotion', 'repeat', 'correction');--> statement-breakpoint
CREATE TYPE "app"."subject_requirement" AS ENUM('compulsory', 'elective');--> statement-breakpoint
CREATE TYPE "app"."lesson_exception_kind" AS ENUM('cancelled', 'substitution', 'room_change');--> statement-breakpoint
CREATE TYPE "app"."period_kind" AS ENUM('lesson', 'break', 'assembly');--> statement-breakpoint
CREATE TYPE "app"."timetable_version_status" AS ENUM('draft', 'published', 'superseded');--> statement-breakpoint
CREATE TYPE "app"."attendance_source" AS ENUM('roll_call', 'leave', 'admin_correction');--> statement-breakpoint
CREATE TYPE "app"."attendance_status" AS ENUM('present', 'absent', 'late', 'excused');--> statement-breakpoint
CREATE TYPE "app"."leave_audience" AS ENUM('student', 'teacher', 'both');--> statement-breakpoint
CREATE TYPE "app"."leave_state" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."roll_call_state" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "app"."attempt_state" AS ENUM('in_progress', 'submitted', 'marked');--> statement-breakpoint
CREATE TYPE "app"."homework_completion_state" AS ENUM('pending', 'submitted', 'completed', 'excused');--> statement-breakpoint
CREATE TYPE "app"."homework_state" AS ENUM('draft', 'published', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "app"."question_kind" AS ENUM('mcq', 'short');--> statement-breakpoint
CREATE TYPE "app"."quiz_state" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "app"."submission_policy" AS ENUM('none', 'optional', 'required');--> statement-breakpoint
CREATE TYPE "app"."absent_rule" AS ENUM('fail', 'zero', 'exclude');--> statement-breakpoint
CREATE TYPE "app"."exam_cycle_state" AS ENUM('draft', 'scheduled', 'marking', 'review', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "app"."exam_kind" AS ENUM('test', 'midterm', 'final', 'other');--> statement-breakpoint
CREATE TYPE "app"."mark_outcome" AS ENUM('score', 'absent', 'exempt', 'withheld', 'missing');--> statement-breakpoint
CREATE TYPE "app"."policy_state" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "app"."promotion_batch_state" AS ENUM('draft', 'reviewed', 'approved', 'executed', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."promotion_decision_kind" AS ENUM('promote', 'repeat', 'graduate', 'withdraw', 'hold');--> statement-breakpoint
CREATE TYPE "app"."promotion_recommendation" AS ENUM('promote', 'repeat', 'graduate', 'review');--> statement-breakpoint
CREATE TYPE "app"."publication_state" AS ENUM('draft', 'published', 'superseded');--> statement-breakpoint
CREATE TYPE "app"."result_outcome" AS ENUM('pass', 'fail', 'incomplete');--> statement-breakpoint
CREATE TYPE "app"."sitting_status" AS ENUM('scheduled', 'rescheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."subject_outcome" AS ENUM('pass', 'fail', 'absent', 'exempt', 'incomplete');--> statement-breakpoint
CREATE TYPE "app"."adjustment_kind" AS ENUM('waiver', 'discount', 'credit', 'refund', 'write_off');--> statement-breakpoint
CREATE TYPE "app"."fee_frequency" AS ENUM('monthly', 'termly', 'annual', 'once');--> statement-breakpoint
CREATE TYPE "app"."fee_kind" AS ENUM('tuition', 'admission', 'exam', 'transport', 'fine', 'other');--> statement-breakpoint
CREATE TYPE "app"."fee_plan_state" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "app"."import_kind" AS ENUM('students', 'teachers', 'bank_statement');--> statement-breakpoint
CREATE TYPE "app"."import_row_status" AS ENUM('valid', 'invalid', 'duplicate', 'matched', 'unmatched', 'review', 'committed', 'skipped');--> statement-breakpoint
CREATE TYPE "app"."import_state" AS ENUM('uploaded', 'validating', 'validated', 'invalid', 'committing', 'committed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."invoice_line_source" AS ENUM('plan', 'manual', 'fine');--> statement-breakpoint
CREATE TYPE "app"."invoice_status" AS ENUM('open', 'void');--> statement-breakpoint
CREATE TYPE "app"."payment_method" AS ENUM('bank', 'cash', 'cheque', 'online');--> statement-breakpoint
CREATE TYPE "app"."payment_status" AS ENUM('posted', 'reversed');--> statement-breakpoint
CREATE TYPE "app"."announcement_category" AS ENUM('general', 'holiday', 'emergency', 'exam', 'fee', 'event');--> statement-breakpoint
CREATE TYPE "app"."announcement_state" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "app"."audience_target" AS ENUM('everyone', 'role', 'class_offering', 'section', 'teaching_group');--> statement-breakpoint
CREATE TYPE "app"."deletion_state" AS ENUM('pending', 'restored', 'processed', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."deletion_subject" AS ENUM('student', 'teacher', 'admin');--> statement-breakpoint
CREATE TYPE "app"."delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'retired');--> statement-breakpoint
CREATE TYPE "app"."report_job_state" AS ENUM('queued', 'running', 'succeeded', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "app"."account_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"role" "app"."role" NOT NULL,
	"granted_by_account_id" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "account_roles_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"auth_user_id" uuid,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"display_name_ur" text,
	"status" "app"."account_status" DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"status_changed_at" timestamp with time zone,
	"provisioning_state" "app"."provisioning_state" DEFAULT 'pending' NOT NULL,
	"provisioning_error" text,
	"provisioning_attempts" integer DEFAULT 0 NOT NULL,
	"locale" "app"."locale" DEFAULT 'en' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"mfa_required" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "accounts_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "accounts_username_normalized" CHECK ("app"."accounts"."username" = lower("app"."accounts"."username"))
);
--> statement-breakpoint
CREATE TABLE "app"."app_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"auth_session_id" text NOT NULL,
	"client" "app"."client_kind" NOT NULL,
	"device_name" text,
	"platform" text,
	"ip_address" text,
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mfa_verified_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	CONSTRAINT "app_sessions_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"actor_account_id" uuid,
	"actor_platform_admin_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text,
	"request_id" text,
	"ip_address" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum_sha256" text,
	"purpose" "app"."file_purpose" NOT NULL,
	"scan_state" "app"."file_scan_state" DEFAULT 'pending' NOT NULL,
	"lifecycle" "app"."file_lifecycle" DEFAULT 'upload_pending' NOT NULL,
	"rejection_reason" text,
	"uploaded_by_account_id" uuid,
	"available_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "files_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_records_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."platform_support_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_admin_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."school_policies" (
	"school_id" uuid PRIMARY KEY NOT NULL,
	"attendance" jsonb DEFAULT '{"workingWeekdays":[1,2,3,4,5,6],"sameDayTeacherCorrection":true}'::jsonb NOT NULL,
	"retention" jsonb DEFAULT '{"recoveryDays":30,"purgeEnabled":false,"exportDownloadHours":24}'::jsonb NOT NULL,
	"notifications" jsonb DEFAULT '{"feeReminderMode":"preview","feeReminderDaysAfterDue":[]}'::jsonb NOT NULL,
	"operations" jsonb DEFAULT '{"offlineCacheDays":7,"minimumMobileVersion":null}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"default_locale" "app"."locale" DEFAULT 'en' NOT NULL,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "app"."school_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "schools_code_format" CHECK ("app"."schools"."code" ~ '^[A-Z0-9-]{2,32}$')
);
--> statement-breakpoint
CREATE TABLE "app"."compensation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"pay_frequency" text DEFAULT 'monthly' NOT NULL,
	"notes" text,
	"recorded_by_account_id" uuid,
	CONSTRAINT "compensation_records_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "compensation_records_amount" CHECK ("app"."compensation_records"."amount" >= 0),
	CONSTRAINT "compensation_records_dates" CHECK ("app"."compensation_records"."effective_to" is null or "app"."compensation_records"."effective_to" > "app"."compensation_records"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "app"."employment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "app"."employment_status" DEFAULT 'active' NOT NULL,
	"job_title" text,
	"notes" text,
	CONSTRAINT "employment_records_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "employment_records_dates" CHECK ("app"."employment_records"."end_date" is null or "app"."employment_records"."end_date" > "app"."employment_records"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"phone" text,
	"alt_phone" text,
	"email" text,
	"address" text,
	"occupation" text,
	CONSTRAINT "guardians_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."student_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"title" text NOT NULL,
	"uploaded_by_account_id" uuid,
	CONSTRAINT "student_documents_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."student_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"relationship" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_emergency" boolean DEFAULT false NOT NULL,
	CONSTRAINT "student_guardians_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"admission_number" text NOT NULL,
	"admission_date" date NOT NULL,
	"gender" "app"."gender",
	"date_of_birth" date,
	"phone" text,
	"email" text,
	"address" text,
	"photo_file_id" uuid,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "students_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."teacher_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"title" text NOT NULL,
	"uploaded_by_account_id" uuid,
	CONSTRAINT "teacher_documents_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"employee_number" text NOT NULL,
	"gender" "app"."gender",
	"phone" text,
	"email" text,
	"address" text,
	"qualifications" text,
	"photo_file_id" uuid,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "teachers_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "app"."academic_year_status" DEFAULT 'planning' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_account_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "academic_years_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "academic_years_dates" CHECK ("app"."academic_years"."end_date" > "app"."academic_years"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."attendance_delegations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"section_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"granted_by_account_id" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "attendance_delegations_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "attendance_delegations_dates" CHECK ("app"."attendance_delegations"."end_date" >= "app"."attendance_delegations"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."class_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"curriculum_version_id" uuid,
	"archived_at" timestamp with time zone,
	CONSTRAINT "class_offerings_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."class_teacher_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"assigned_by_account_id" uuid,
	CONSTRAINT "class_teacher_assignments_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "class_teacher_assignments_dates" CHECK ("app"."class_teacher_assignments"."end_date" is null or "app"."class_teacher_assignments"."end_date" > "app"."class_teacher_assignments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."course_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"class_offering_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"requirement" "app"."subject_requirement" DEFAULT 'compulsory' NOT NULL,
	"stream_id" uuid,
	"weight" numeric(5, 2) DEFAULT '1' NOT NULL,
	"credit" numeric(4, 1),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "course_offerings_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."curriculum_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"curriculum_version_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"requirement" "app"."subject_requirement" DEFAULT 'compulsory' NOT NULL,
	"stream_id" uuid,
	"weight" numeric(5, 2) DEFAULT '1' NOT NULL,
	"credit" numeric(4, 1),
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "curriculum_subjects_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."curriculum_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"name" text NOT NULL,
	"state" "app"."curriculum_state" DEFAULT 'draft' NOT NULL,
	"notes" text,
	CONSTRAINT "curriculum_versions_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."grade_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"sort_order" integer NOT NULL,
	"next_grade_level_id" uuid,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "grade_levels_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "grade_levels_terminal" CHECK (not ("app"."grade_levels"."is_terminal" and "app"."grade_levels"."next_grade_level_id" is not null)),
	CONSTRAINT "grade_levels_not_self" CHECK ("app"."grade_levels"."next_grade_level_id" is null or "app"."grade_levels"."next_grade_level_id" <> "app"."grade_levels"."id")
);
--> statement-breakpoint
CREATE TABLE "app"."rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"capacity" integer,
	"archived_at" timestamp with time zone,
	CONSTRAINT "rooms_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."school_calendar_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"academic_year_id" uuid,
	"date" date NOT NULL,
	"kind" "app"."calendar_day_kind" NOT NULL,
	"title" text NOT NULL,
	"title_ur" text,
	"note" text,
	CONSTRAINT "school_calendar_days_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"class_offering_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"capacity" integer,
	"home_room_id" uuid,
	"archived_at" timestamp with time zone,
	CONSTRAINT "sections_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"description" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "streams_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."student_course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "app"."course_enrollment_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "student_course_enrollments_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "student_course_enrollments_dates" CHECK ("app"."student_course_enrollments"."end_date" is null or "app"."student_course_enrollments"."end_date" > "app"."student_course_enrollments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."student_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"class_offering_id" uuid NOT NULL,
	"status" "app"."enrollment_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status_reason" text,
	"source_promotion_decision_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "student_enrollments_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."student_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"reason" "app"."placement_reason" NOT NULL,
	"note" text,
	"created_by_account_id" uuid,
	CONSTRAINT "student_placements_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "student_placements_dates" CHECK ("app"."student_placements"."end_date" is null or "app"."student_placements"."end_date" > "app"."student_placements"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."student_stream_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"stream_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"note" text,
	CONSTRAINT "student_stream_assignments_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "student_stream_assignments_dates" CHECK ("app"."student_stream_assignments"."end_date" is null or "app"."student_stream_assignments"."end_date" > "app"."student_stream_assignments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"archived_at" timestamp with time zone,
	CONSTRAINT "subjects_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."teacher_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"teaching_group_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_primary" boolean DEFAULT true NOT NULL,
	"assigned_by_account_id" uuid,
	CONSTRAINT "teacher_assignments_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "teacher_assignments_dates" CHECK ("app"."teacher_assignments"."end_date" is null or "app"."teacher_assignments"."end_date" > "app"."teacher_assignments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."teaching_group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teaching_group_id" uuid NOT NULL,
	"student_course_enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	CONSTRAINT "teaching_group_memberships_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "tgm_dates" CHECK ("app"."teaching_group_memberships"."end_date" is null or "app"."teaching_group_memberships"."end_date" > "app"."teaching_group_memberships"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."teaching_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"section_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "teaching_groups_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"sequence" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	CONSTRAINT "terms_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "terms_dates" CHECK ("app"."terms"."end_date" > "app"."terms"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."lesson_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timetable_lesson_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "app"."lesson_exception_kind" NOT NULL,
	"substitute_teacher_id" uuid,
	"room_id" uuid,
	"note" text,
	"created_by_account_id" uuid,
	CONSTRAINT "lesson_exceptions_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "lesson_exceptions_substitute_required" CHECK ("app"."lesson_exceptions"."kind" <> 'substitution' or "app"."lesson_exceptions"."substitute_teacher_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "app"."period_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"kind" "app"."period_kind" DEFAULT 'lesson' NOT NULL,
	CONSTRAINT "period_definitions_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "period_definitions_times" CHECK ("app"."period_definitions"."end_time" > "app"."period_definitions"."start_time")
);
--> statement-breakpoint
CREATE TABLE "app"."timetable_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timetable_version_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"period_definition_id" uuid NOT NULL,
	"teaching_group_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"room_id" uuid,
	CONSTRAINT "timetable_lessons_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "timetable_lessons_weekday" CHECK ("app"."timetable_lessons"."weekday" between 1 and 7)
);
--> statement-breakpoint
CREATE TABLE "app"."timetable_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "app"."timetable_version_status" DEFAULT 'draft' NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"published_at" timestamp with time zone,
	"published_by_account_id" uuid,
	"validation" jsonb,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "timetable_versions_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."attendance_reason_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"label_ur" text,
	"applies_to" "app"."attendance_status",
	"archived_at" timestamp with time zone,
	CONSTRAINT "attendance_reason_codes_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."attendance_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_attendance_id" uuid,
	"teacher_attendance_id" uuid,
	"previous_status" "app"."attendance_status",
	"new_status" "app"."attendance_status",
	"reason" text NOT NULL,
	"changed_by_account_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_revisions_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "attendance_revisions_subject" CHECK (num_nonnulls("app"."attendance_revisions"."student_attendance_id", "app"."attendance_revisions"."teacher_attendance_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "app"."attendance_roll_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"section_id" uuid NOT NULL,
	"date" date NOT NULL,
	"state" "app"."roll_call_state" DEFAULT 'draft' NOT NULL,
	"roster_revision" text,
	"draft_entries" jsonb,
	"submitted_by_account_id" uuid,
	"submitted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "attendance_roll_calls_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."disciplinary_suspensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text NOT NULL,
	"decided_by_account_id" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	CONSTRAINT "disciplinary_suspensions_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "disciplinary_suspensions_dates" CHECK ("app"."disciplinary_suspensions"."end_date" >= "app"."disciplinary_suspensions"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"requester_account_id" uuid NOT NULL,
	"student_id" uuid,
	"teacher_id" uuid,
	"leave_type_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text NOT NULL,
	"state" "app"."leave_state" DEFAULT 'pending' NOT NULL,
	"decided_by_account_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"cancelled_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "leave_requests_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "leave_requests_subject" CHECK (num_nonnulls("app"."leave_requests"."student_id", "app"."leave_requests"."teacher_id") = 1),
	CONSTRAINT "leave_requests_dates" CHECK ("app"."leave_requests"."end_date" >= "app"."leave_requests"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"audience" "app"."leave_audience" DEFAULT 'both' NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "leave_types_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."student_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"placement_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"roll_call_id" uuid,
	"date" date NOT NULL,
	"status" "app"."attendance_status" NOT NULL,
	"reason_code_id" uuid,
	"note" text,
	"source" "app"."attendance_source" DEFAULT 'roll_call' NOT NULL,
	"leave_request_id" uuid,
	"recorded_by_account_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "student_attendance_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."teacher_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "app"."attendance_status" NOT NULL,
	"reason_code_id" uuid,
	"note" text,
	"source" "app"."attendance_source" DEFAULT 'admin_correction' NOT NULL,
	"leave_request_id" uuid,
	"recorded_by_account_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "teacher_attendance_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."homework" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teaching_group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"title_ur" text,
	"instructions" text,
	"instructions_ur" text,
	"due_date" date NOT NULL,
	"due_time" time,
	"submission_policy" "app"."submission_policy" DEFAULT 'optional' NOT NULL,
	"max_score" numeric(7, 2),
	"state" "app"."homework_state" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_teacher_id" uuid,
	"created_by_account_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "homework_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."homework_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"homework_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "homework_attachments_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."homework_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"homework_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"student_course_enrollment_id" uuid,
	"completion_state" "app"."homework_completion_state" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"added_reason" text DEFAULT 'publish' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "homework_recipients_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."homework_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"body" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"feedback" text,
	"score" numeric(7, 2),
	"feedback_by_account_id" uuid,
	"feedback_at" timestamp with time zone,
	CONSTRAINT "homework_submissions_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."learning_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teaching_group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"title_ur" text,
	"description" text,
	"file_id" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_account_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "learning_materials_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"text_answer" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"auto_score" numeric(7, 2),
	"manual_score" numeric(7, 2),
	"marked_by_account_id" uuid,
	"marked_at" timestamp with time zone,
	"feedback" text,
	CONSTRAINT "quiz_answers_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."quiz_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"student_course_enrollment_id" uuid,
	"extra_attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quiz_assignments_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quiz_assignment_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"content_version" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"auto_submitted" boolean DEFAULT false NOT NULL,
	"state" "app"."attempt_state" DEFAULT 'in_progress' NOT NULL,
	"score" numeric(7, 2),
	"max_score" numeric(7, 2),
	CONSTRAINT "quiz_attempts_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."quiz_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"question_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"text" text NOT NULL,
	"text_ur" text,
	"is_correct" boolean DEFAULT false NOT NULL,
	CONSTRAINT "quiz_options_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"content_version" integer NOT NULL,
	"sequence" integer NOT NULL,
	"kind" "app"."question_kind" NOT NULL,
	"prompt" text NOT NULL,
	"prompt_ur" text,
	"points" numeric(7, 2) NOT NULL,
	"guidance" text,
	CONSTRAINT "quiz_questions_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "quiz_questions_points" CHECK ("app"."quiz_questions"."points" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"teaching_group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"title_ur" text,
	"instructions" text,
	"state" "app"."quiz_state" DEFAULT 'draft' NOT NULL,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"time_limit_minutes" integer,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"content_version" integer DEFAULT 1 NOT NULL,
	"results_released_at" timestamp with time zone,
	"created_by_account_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "quizzes_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "quizzes_attempts" CHECK ("app"."quizzes"."max_attempts" >= 1),
	CONSTRAINT "quizzes_time_limit" CHECK ("app"."quizzes"."time_limit_minutes" is null or "app"."quizzes"."time_limit_minutes" > 0),
	CONSTRAINT "quizzes_window" CHECK ("app"."quizzes"."available_from" is null or "app"."quizzes"."available_until" is null or "app"."quizzes"."available_until" > "app"."quizzes"."available_from")
);
--> statement-breakpoint
CREATE TABLE "app"."submission_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submission_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "submission_attachments_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."assessment_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"exam_kind" "app"."exam_kind" NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	CONSTRAINT "assessment_weights_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."exam_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"term_id" uuid,
	"name" text NOT NULL,
	"name_ur" text,
	"kind" "app"."exam_kind" NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"state" "app"."exam_cycle_state" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "exam_cycles_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."exam_papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exam_cycle_id" uuid NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"max_marks" numeric(7, 2) NOT NULL,
	"pass_marks" numeric(7, 2) NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "exam_papers_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "exam_papers_marks" CHECK ("app"."exam_papers"."max_marks" > 0 and "app"."exam_papers"."pass_marks" >= 0 and "app"."exam_papers"."pass_marks" <= "app"."exam_papers"."max_marks")
);
--> statement-breakpoint
CREATE TABLE "app"."exam_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exam_paper_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"student_course_enrollment_id" uuid NOT NULL,
	"section_id" uuid,
	CONSTRAINT "exam_registrations_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."exam_sittings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exam_paper_id" uuid NOT NULL,
	"section_id" uuid,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"room_id" uuid,
	"status" "app"."sitting_status" DEFAULT 'scheduled' NOT NULL,
	"replaced_by_sitting_id" uuid,
	"note" text,
	CONSTRAINT "exam_sittings_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "exam_sittings_times" CHECK ("app"."exam_sittings"."end_time" > "app"."exam_sittings"."start_time")
);
--> statement-breakpoint
CREATE TABLE "app"."grade_bands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"label" text NOT NULL,
	"min_percentage" numeric(5, 2) NOT NULL,
	"max_percentage" numeric(5, 2) NOT NULL,
	"grade_points" numeric(4, 2),
	"is_passing" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "grade_bands_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "grade_bands_range" CHECK ("app"."grade_bands"."min_percentage" >= 0 and "app"."grade_bands"."max_percentage" <= 100 and "app"."grade_bands"."max_percentage" > "app"."grade_bands"."min_percentage")
);
--> statement-breakpoint
CREATE TABLE "app"."grading_policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"version_number" integer NOT NULL,
	"state" "app"."policy_state" DEFAULT 'draft' NOT NULL,
	"pass_requirement" jsonb NOT NULL,
	"absent_rule" "app"."absent_rule" DEFAULT 'fail' NOT NULL,
	"display_decimals" integer DEFAULT 2 NOT NULL,
	"gpa_enabled" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"created_by_account_id" uuid,
	CONSTRAINT "grading_policy_versions_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."mark_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mark_id" uuid NOT NULL,
	"previous_outcome" "app"."mark_outcome",
	"previous_score" numeric(7, 2),
	"new_outcome" "app"."mark_outcome" NOT NULL,
	"new_score" numeric(7, 2),
	"reason" text,
	"changed_by_account_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mark_revisions_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exam_registration_id" uuid NOT NULL,
	"outcome" "app"."mark_outcome" NOT NULL,
	"score" numeric(7, 2),
	"note" text,
	"recorded_by_account_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "marks_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "marks_score_outcome" CHECK (("app"."marks"."outcome" = 'score' and "app"."marks"."score" is not null and "app"."marks"."score" >= 0) or ("app"."marks"."outcome" <> 'score' and "app"."marks"."score" is null))
);
--> statement-breakpoint
CREATE TABLE "app"."promotion_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_academic_year_id" uuid NOT NULL,
	"target_academic_year_id" uuid NOT NULL,
	"source_class_offering_id" uuid NOT NULL,
	"result_publication_id" uuid NOT NULL,
	"results_fingerprint" text NOT NULL,
	"state" "app"."promotion_batch_state" DEFAULT 'draft' NOT NULL,
	"approved_by_account_id" uuid,
	"approved_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"created_by_account_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "promotion_batches_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "promotion_batches_years" CHECK ("app"."promotion_batches"."source_academic_year_id" <> "app"."promotion_batches"."target_academic_year_id")
);
--> statement-breakpoint
CREATE TABLE "app"."promotion_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"batch_id" uuid NOT NULL,
	"source_enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"student_result_id" uuid,
	"recommendation" "app"."promotion_recommendation" NOT NULL,
	"decision" "app"."promotion_decision_kind",
	"override_reason" text,
	"destination_class_offering_id" uuid,
	"destination_section_id" uuid,
	"destination_enrollment_id" uuid,
	"executed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "promotion_decisions_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "promotion_decisions_override_reason" CHECK ("app"."promotion_decisions"."decision" is null or "app"."promotion_decisions"."decision"::text = "app"."promotion_decisions"."recommendation"::text or "app"."promotion_decisions"."override_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "app"."result_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"exam_cycle_id" uuid NOT NULL,
	"class_offering_id" uuid NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"state" "app"."publication_state" DEFAULT 'draft' NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"input_snapshot" jsonb,
	"correction_reason" text,
	"supersedes_id" uuid,
	"published_at" timestamp with time zone,
	"published_by_account_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "result_publications_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."student_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"publication_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"section_id" uuid,
	"obtained_marks" numeric(7, 2),
	"total_marks" numeric(7, 2),
	"percentage" numeric(9, 4),
	"grade_label" text,
	"gpa" numeric(5, 3),
	"outcome" "app"."result_outcome" NOT NULL,
	"failed_subjects" integer DEFAULT 0 NOT NULL,
	"remarks" text,
	CONSTRAINT "student_results_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."subject_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_result_id" uuid NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"obtained_marks" numeric(7, 2),
	"max_marks" numeric(7, 2) NOT NULL,
	"percentage" numeric(9, 4),
	"grade_label" text,
	"grade_points" numeric(4, 2),
	"outcome" "app"."subject_outcome" NOT NULL,
	CONSTRAINT "subject_results_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number_masked" text,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "bank_accounts_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."bank_import_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mapping_version" integer DEFAULT 1 NOT NULL,
	"mapping" jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "bank_import_profiles_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."document_counters" (
	"school_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"next_value" integer NOT NULL,
	CONSTRAINT "document_counters_school_id_kind_pk" PRIMARY KEY("school_id","kind")
);
--> statement-breakpoint
CREATE TABLE "app"."fee_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fee_plan_id" uuid NOT NULL,
	"fee_type_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"description" text,
	CONSTRAINT "fee_plan_items_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "fee_plan_items_amount" CHECK ("app"."fee_plan_items"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."fee_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"frequency" "app"."fee_frequency" NOT NULL,
	"due_day" integer DEFAULT 10 NOT NULL,
	"state" "app"."fee_plan_state" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "fee_plans_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "fee_plans_due_day" CHECK ("app"."fee_plans"."due_day" between 1 and 28)
);
--> statement-breakpoint
CREATE TABLE "app"."fee_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"kind" "app"."fee_kind" NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "fee_types_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."financial_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid NOT NULL,
	"invoice_id" uuid,
	"payment_id" uuid,
	"kind" "app"."adjustment_kind" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"approved_by_account_id" uuid NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversed_by_account_id" uuid,
	"reversal_reason" text,
	CONSTRAINT "financial_adjustments_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "financial_adjustments_amount" CHECK ("app"."financial_adjustments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "app"."import_kind" NOT NULL,
	"file_id" uuid,
	"file_name" text NOT NULL,
	"file_hash" text NOT NULL,
	"bank_import_profile_id" uuid,
	"mapping_version" integer,
	"state" "app"."import_state" DEFAULT 'uploaded' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"committed_by_account_id" uuid,
	"committed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "import_batches_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"normalized" jsonb,
	"status" "app"."import_row_status" NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence" jsonb,
	"resolution" jsonb,
	"outcome" jsonb,
	"fingerprint" text,
	CONSTRAINT "import_rows_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"fee_type_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"source" "app"."invoice_line_source" NOT NULL,
	"created_by_account_id" uuid,
	CONSTRAINT "invoice_lines_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "invoice_lines_amount" CHECK ("app"."invoice_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"academic_year_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"period_label" text NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "app"."invoice_status" DEFAULT 'open' NOT NULL,
	"total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"adjusted_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"generation_key" text,
	"void_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "invoices_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "invoices_amounts" CHECK ("app"."invoices"."total_amount" >= 0 and "app"."invoices"."paid_amount" >= 0 and "app"."invoices"."adjusted_amount" >= 0 and "app"."invoices"."paid_amount" + "app"."invoices"."adjusted_amount" <= "app"."invoices"."total_amount"),
	CONSTRAINT "invoices_dates" CHECK ("app"."invoices"."due_date" >= "app"."invoices"."issue_date")
);
--> statement-breakpoint
CREATE TABLE "app"."payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversed_by_account_id" uuid,
	CONSTRAINT "payment_allocations_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "payment_allocations_amount" CHECK ("app"."payment_allocations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid,
	"bank_account_id" uuid,
	"method" "app"."payment_method" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"received_on" date NOT NULL,
	"bank_transaction_id" text,
	"payer_reference" text,
	"description" text,
	"receipt_number" text NOT NULL,
	"status" "app"."payment_status" DEFAULT 'posted' NOT NULL,
	"reversal_of_payment_id" uuid,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	"import_row_id" uuid,
	"fingerprint" text,
	"recorded_by_account_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "payments_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "payments_amount" CHECK ("app"."payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."student_fee_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"fee_plan_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"discount_percentage" numeric(5, 2),
	"note" text,
	CONSTRAINT "student_fee_assignments_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "student_fee_assignments_dates" CHECK ("app"."student_fee_assignments"."end_date" is null or "app"."student_fee_assignments"."end_date" > "app"."student_fee_assignments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "app"."announcement_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "announcement_attachments_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."announcement_audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"target" "app"."audience_target" NOT NULL,
	"role" "app"."role",
	"class_offering_id" uuid,
	"section_id" uuid,
	"teaching_group_id" uuid,
	CONSTRAINT "announcement_audiences_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"title_ur" text,
	"body" text NOT NULL,
	"body_ur" text,
	"category" "app"."announcement_category" DEFAULT 'general' NOT NULL,
	"state" "app"."announcement_state" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_account_id" uuid NOT NULL,
	"recipient_count" integer,
	CONSTRAINT "announcements_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subject_type" "app"."deletion_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"reason" text,
	"requested_by_account_id" uuid NOT NULL,
	"recover_until" timestamp with time zone NOT NULL,
	"state" "app"."deletion_state" DEFAULT 'pending' NOT NULL,
	"restored_by_account_id" uuid,
	"restored_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"processing_summary" jsonb,
	CONSTRAINT "deletion_requests_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"app_session_id" uuid,
	"expo_push_token" text NOT NULL,
	"platform" text NOT NULL,
	"locale" "app"."locale" DEFAULT 'en' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	"retired_reason" text,
	CONSTRAINT "device_tokens_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"device_token_id" uuid NOT NULL,
	"status" "app"."delivery_status" DEFAULT 'pending' NOT NULL,
	"ticket_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"receipt_checked_at" timestamp with time zone,
	CONSTRAINT "notification_deliveries_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."notification_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notification_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "notification_recipients_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"link" text,
	"dedupe_key" text,
	"created_by_account_id" uuid,
	CONSTRAINT "notifications_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."report_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"format" text NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" "app"."report_job_state" DEFAULT 'queued' NOT NULL,
	"file_id" uuid,
	"error" text,
	"requested_by_account_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "report_jobs_tenant_uk" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."retention_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"placed_by_account_id" uuid NOT NULL,
	"released_at" timestamp with time zone,
	"released_by_account_id" uuid,
	CONSTRAINT "retention_holds_tenant_uk" UNIQUE("school_id","id"),
	CONSTRAINT "retention_holds_release" CHECK ("app"."retention_holds"."released_at" is null or "app"."retention_holds"."released_by_account_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "app"."account_roles" ADD CONSTRAINT "account_roles_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_roles" ADD CONSTRAINT "account_roles_account_fk" FOREIGN KEY ("school_id","account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."accounts" ADD CONSTRAINT "accounts_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."app_sessions" ADD CONSTRAINT "app_sessions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."app_sessions" ADD CONSTRAINT "app_sessions_account_fk" FOREIGN KEY ("school_id","account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_events" ADD CONSTRAINT "audit_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_events" ADD CONSTRAINT "audit_events_actor_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("actor_platform_admin_id") REFERENCES "app"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_events" ADD CONSTRAINT "audit_events_actor_fk" FOREIGN KEY ("school_id","actor_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."files" ADD CONSTRAINT "files_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."files" ADD CONSTRAINT "files_uploader_fk" FOREIGN KEY ("school_id","uploaded_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."idempotency_records" ADD CONSTRAINT "idempotency_records_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."idempotency_records" ADD CONSTRAINT "idempotency_records_account_fk" FOREIGN KEY ("school_id","account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."platform_support_grants" ADD CONSTRAINT "platform_support_grants_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("platform_admin_id") REFERENCES "app"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."platform_support_grants" ADD CONSTRAINT "platform_support_grants_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."school_policies" ADD CONSTRAINT "school_policies_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."compensation_records" ADD CONSTRAINT "compensation_records_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."compensation_records" ADD CONSTRAINT "compensation_records_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."compensation_records" ADD CONSTRAINT "compensation_records_recorder_fk" FOREIGN KEY ("school_id","recorded_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."employment_records" ADD CONSTRAINT "employment_records_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."employment_records" ADD CONSTRAINT "employment_records_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."guardians" ADD CONSTRAINT "guardians_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_documents" ADD CONSTRAINT "student_documents_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_documents" ADD CONSTRAINT "student_documents_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_documents" ADD CONSTRAINT "student_documents_file_fk" FOREIGN KEY ("school_id","file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_guardians" ADD CONSTRAINT "student_guardians_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_guardians" ADD CONSTRAINT "student_guardians_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_guardians" ADD CONSTRAINT "student_guardians_guardian_fk" FOREIGN KEY ("school_id","guardian_id") REFERENCES "app"."guardians"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."students" ADD CONSTRAINT "students_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."students" ADD CONSTRAINT "students_account_fk" FOREIGN KEY ("school_id","account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."students" ADD CONSTRAINT "students_photo_fk" FOREIGN KEY ("school_id","photo_file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_documents" ADD CONSTRAINT "teacher_documents_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_documents" ADD CONSTRAINT "teacher_documents_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_documents" ADD CONSTRAINT "teacher_documents_file_fk" FOREIGN KEY ("school_id","file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teachers" ADD CONSTRAINT "teachers_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teachers" ADD CONSTRAINT "teachers_account_fk" FOREIGN KEY ("school_id","account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teachers" ADD CONSTRAINT "teachers_photo_fk" FOREIGN KEY ("school_id","photo_file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."academic_years" ADD CONSTRAINT "academic_years_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."academic_years" ADD CONSTRAINT "academic_years_closed_by_fk" FOREIGN KEY ("school_id","closed_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_delegations" ADD CONSTRAINT "attendance_delegations_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_delegations" ADD CONSTRAINT "attendance_delegations_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_delegations" ADD CONSTRAINT "attendance_delegations_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."class_offerings" ADD CONSTRAINT "class_offerings_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."class_offerings" ADD CONSTRAINT "class_offerings_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."class_offerings" ADD CONSTRAINT "class_offerings_grade_fk" FOREIGN KEY ("school_id","grade_level_id") REFERENCES "app"."grade_levels"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."class_offerings" ADD CONSTRAINT "class_offerings_curriculum_fk" FOREIGN KEY ("school_id","curriculum_version_id") REFERENCES "app"."curriculum_versions"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."class_teacher_assignments" ADD CONSTRAINT "class_teacher_assignments_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."course_offerings" ADD CONSTRAINT "course_offerings_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."course_offerings" ADD CONSTRAINT "course_offerings_class_offering_fk" FOREIGN KEY ("school_id","class_offering_id") REFERENCES "app"."class_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."course_offerings" ADD CONSTRAINT "course_offerings_subject_fk" FOREIGN KEY ("school_id","subject_id") REFERENCES "app"."subjects"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."course_offerings" ADD CONSTRAINT "course_offerings_stream_fk" FOREIGN KEY ("school_id","stream_id") REFERENCES "app"."streams"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_version_fk" FOREIGN KEY ("school_id","curriculum_version_id") REFERENCES "app"."curriculum_versions"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_subject_fk" FOREIGN KEY ("school_id","subject_id") REFERENCES "app"."subjects"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_stream_fk" FOREIGN KEY ("school_id","stream_id") REFERENCES "app"."streams"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."curriculum_versions" ADD CONSTRAINT "curriculum_versions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."curriculum_versions" ADD CONSTRAINT "curriculum_versions_grade_fk" FOREIGN KEY ("school_id","grade_level_id") REFERENCES "app"."grade_levels"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grade_levels" ADD CONSTRAINT "grade_levels_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grade_levels" ADD CONSTRAINT "grade_levels_next_fk" FOREIGN KEY ("school_id","next_grade_level_id") REFERENCES "app"."grade_levels"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rooms" ADD CONSTRAINT "rooms_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."school_calendar_days" ADD CONSTRAINT "school_calendar_days_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."school_calendar_days" ADD CONSTRAINT "school_calendar_days_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sections" ADD CONSTRAINT "sections_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sections" ADD CONSTRAINT "sections_class_offering_fk" FOREIGN KEY ("school_id","class_offering_id") REFERENCES "app"."class_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sections" ADD CONSTRAINT "sections_room_fk" FOREIGN KEY ("school_id","home_room_id") REFERENCES "app"."rooms"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."streams" ADD CONSTRAINT "streams_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_course_enrollments" ADD CONSTRAINT "student_course_enrollments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_course_enrollments" ADD CONSTRAINT "student_course_enrollments_enrollment_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_course_enrollments" ADD CONSTRAINT "student_course_enrollments_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_course_enrollments" ADD CONSTRAINT "student_course_enrollments_course_fk" FOREIGN KEY ("school_id","course_offering_id") REFERENCES "app"."course_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_enrollments" ADD CONSTRAINT "student_enrollments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_enrollments" ADD CONSTRAINT "student_enrollments_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_enrollments" ADD CONSTRAINT "student_enrollments_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_enrollments" ADD CONSTRAINT "student_enrollments_class_offering_fk" FOREIGN KEY ("school_id","class_offering_id") REFERENCES "app"."class_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_placements" ADD CONSTRAINT "student_placements_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_placements" ADD CONSTRAINT "student_placements_enrollment_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_placements" ADD CONSTRAINT "student_placements_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_placements" ADD CONSTRAINT "student_placements_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_stream_assignments" ADD CONSTRAINT "student_stream_assignments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_stream_assignments" ADD CONSTRAINT "student_stream_assignments_enrollment_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_stream_assignments" ADD CONSTRAINT "student_stream_assignments_stream_fk" FOREIGN KEY ("school_id","stream_id") REFERENCES "app"."streams"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subjects" ADD CONSTRAINT "subjects_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_assignments" ADD CONSTRAINT "teacher_assignments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_assignments" ADD CONSTRAINT "teacher_assignments_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_assignments" ADD CONSTRAINT "teacher_assignments_group_fk" FOREIGN KEY ("school_id","teaching_group_id") REFERENCES "app"."teaching_groups"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teaching_group_memberships" ADD CONSTRAINT "teaching_group_memberships_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teaching_group_memberships" ADD CONSTRAINT "tgm_group_fk" FOREIGN KEY ("school_id","teaching_group_id") REFERENCES "app"."teaching_groups"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teaching_group_memberships" ADD CONSTRAINT "tgm_course_enrollment_fk" FOREIGN KEY ("school_id","student_course_enrollment_id") REFERENCES "app"."student_course_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teaching_group_memberships" ADD CONSTRAINT "tgm_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teaching_groups" ADD CONSTRAINT "teaching_groups_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teaching_groups" ADD CONSTRAINT "teaching_groups_course_fk" FOREIGN KEY ("school_id","course_offering_id") REFERENCES "app"."course_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teaching_groups" ADD CONSTRAINT "teaching_groups_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."terms" ADD CONSTRAINT "terms_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."terms" ADD CONSTRAINT "terms_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lesson_exceptions" ADD CONSTRAINT "lesson_exceptions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lesson_exceptions" ADD CONSTRAINT "lesson_exceptions_lesson_fk" FOREIGN KEY ("school_id","timetable_lesson_id") REFERENCES "app"."timetable_lessons"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lesson_exceptions" ADD CONSTRAINT "lesson_exceptions_substitute_fk" FOREIGN KEY ("school_id","substitute_teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lesson_exceptions" ADD CONSTRAINT "lesson_exceptions_room_fk" FOREIGN KEY ("school_id","room_id") REFERENCES "app"."rooms"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."period_definitions" ADD CONSTRAINT "period_definitions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."period_definitions" ADD CONSTRAINT "period_definitions_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."timetable_lessons" ADD CONSTRAINT "timetable_lessons_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."timetable_lessons" ADD CONSTRAINT "timetable_lessons_version_fk" FOREIGN KEY ("school_id","timetable_version_id") REFERENCES "app"."timetable_versions"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."timetable_lessons" ADD CONSTRAINT "timetable_lessons_period_fk" FOREIGN KEY ("school_id","period_definition_id") REFERENCES "app"."period_definitions"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."timetable_lessons" ADD CONSTRAINT "timetable_lessons_group_fk" FOREIGN KEY ("school_id","teaching_group_id") REFERENCES "app"."teaching_groups"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."timetable_lessons" ADD CONSTRAINT "timetable_lessons_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."timetable_lessons" ADD CONSTRAINT "timetable_lessons_room_fk" FOREIGN KEY ("school_id","room_id") REFERENCES "app"."rooms"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."timetable_versions" ADD CONSTRAINT "timetable_versions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."timetable_versions" ADD CONSTRAINT "timetable_versions_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."timetable_versions" ADD CONSTRAINT "timetable_versions_publisher_fk" FOREIGN KEY ("school_id","published_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_reason_codes" ADD CONSTRAINT "attendance_reason_codes_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_revisions" ADD CONSTRAINT "attendance_revisions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_revisions" ADD CONSTRAINT "attendance_revisions_student_fk" FOREIGN KEY ("school_id","student_attendance_id") REFERENCES "app"."student_attendance"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_revisions" ADD CONSTRAINT "attendance_revisions_teacher_fk" FOREIGN KEY ("school_id","teacher_attendance_id") REFERENCES "app"."teacher_attendance"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_revisions" ADD CONSTRAINT "attendance_revisions_changer_fk" FOREIGN KEY ("school_id","changed_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_roll_calls" ADD CONSTRAINT "attendance_roll_calls_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_roll_calls" ADD CONSTRAINT "attendance_roll_calls_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attendance_roll_calls" ADD CONSTRAINT "attendance_roll_calls_submitter_fk" FOREIGN KEY ("school_id","submitted_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."disciplinary_suspensions" ADD CONSTRAINT "disciplinary_suspensions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."disciplinary_suspensions" ADD CONSTRAINT "disciplinary_suspensions_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."disciplinary_suspensions" ADD CONSTRAINT "disciplinary_suspensions_decider_fk" FOREIGN KEY ("school_id","decided_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leave_requests" ADD CONSTRAINT "leave_requests_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leave_requests" ADD CONSTRAINT "leave_requests_requester_fk" FOREIGN KEY ("school_id","requester_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leave_requests" ADD CONSTRAINT "leave_requests_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leave_requests" ADD CONSTRAINT "leave_requests_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leave_requests" ADD CONSTRAINT "leave_requests_type_fk" FOREIGN KEY ("school_id","leave_type_id") REFERENCES "app"."leave_types"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leave_requests" ADD CONSTRAINT "leave_requests_decider_fk" FOREIGN KEY ("school_id","decided_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."leave_types" ADD CONSTRAINT "leave_types_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_attendance" ADD CONSTRAINT "student_attendance_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_attendance" ADD CONSTRAINT "student_attendance_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_attendance" ADD CONSTRAINT "student_attendance_enrollment_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_attendance" ADD CONSTRAINT "student_attendance_placement_fk" FOREIGN KEY ("school_id","placement_id") REFERENCES "app"."student_placements"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_attendance" ADD CONSTRAINT "student_attendance_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_attendance" ADD CONSTRAINT "student_attendance_roll_call_fk" FOREIGN KEY ("school_id","roll_call_id") REFERENCES "app"."attendance_roll_calls"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_attendance" ADD CONSTRAINT "student_attendance_reason_fk" FOREIGN KEY ("school_id","reason_code_id") REFERENCES "app"."attendance_reason_codes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_attendance" ADD CONSTRAINT "student_attendance_leave_fk" FOREIGN KEY ("school_id","leave_request_id") REFERENCES "app"."leave_requests"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_attendance" ADD CONSTRAINT "student_attendance_recorder_fk" FOREIGN KEY ("school_id","recorded_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_attendance" ADD CONSTRAINT "teacher_attendance_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_attendance" ADD CONSTRAINT "teacher_attendance_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_attendance" ADD CONSTRAINT "teacher_attendance_reason_fk" FOREIGN KEY ("school_id","reason_code_id") REFERENCES "app"."attendance_reason_codes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_attendance" ADD CONSTRAINT "teacher_attendance_leave_fk" FOREIGN KEY ("school_id","leave_request_id") REFERENCES "app"."leave_requests"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."teacher_attendance" ADD CONSTRAINT "teacher_attendance_recorder_fk" FOREIGN KEY ("school_id","recorded_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework" ADD CONSTRAINT "homework_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework" ADD CONSTRAINT "homework_group_fk" FOREIGN KEY ("school_id","teaching_group_id") REFERENCES "app"."teaching_groups"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework" ADD CONSTRAINT "homework_teacher_fk" FOREIGN KEY ("school_id","created_by_teacher_id") REFERENCES "app"."teachers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework" ADD CONSTRAINT "homework_creator_fk" FOREIGN KEY ("school_id","created_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_attachments" ADD CONSTRAINT "homework_attachments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_attachments" ADD CONSTRAINT "homework_attachments_homework_fk" FOREIGN KEY ("school_id","homework_id") REFERENCES "app"."homework"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_attachments" ADD CONSTRAINT "homework_attachments_file_fk" FOREIGN KEY ("school_id","file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_recipients" ADD CONSTRAINT "homework_recipients_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_recipients" ADD CONSTRAINT "homework_recipients_homework_fk" FOREIGN KEY ("school_id","homework_id") REFERENCES "app"."homework"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_recipients" ADD CONSTRAINT "homework_recipients_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_recipients" ADD CONSTRAINT "homework_recipients_sce_fk" FOREIGN KEY ("school_id","student_course_enrollment_id") REFERENCES "app"."student_course_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_submissions" ADD CONSTRAINT "homework_submissions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_submissions" ADD CONSTRAINT "homework_submissions_recipient_fk" FOREIGN KEY ("school_id","recipient_id") REFERENCES "app"."homework_recipients"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."homework_submissions" ADD CONSTRAINT "homework_submissions_feedback_by_fk" FOREIGN KEY ("school_id","feedback_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."learning_materials" ADD CONSTRAINT "learning_materials_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."learning_materials" ADD CONSTRAINT "learning_materials_group_fk" FOREIGN KEY ("school_id","teaching_group_id") REFERENCES "app"."teaching_groups"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."learning_materials" ADD CONSTRAINT "learning_materials_file_fk" FOREIGN KEY ("school_id","file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."learning_materials" ADD CONSTRAINT "learning_materials_creator_fk" FOREIGN KEY ("school_id","created_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_answers" ADD CONSTRAINT "quiz_answers_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_fk" FOREIGN KEY ("school_id","attempt_id") REFERENCES "app"."quiz_attempts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_answers" ADD CONSTRAINT "quiz_answers_question_fk" FOREIGN KEY ("school_id","question_id") REFERENCES "app"."quiz_questions"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_answers" ADD CONSTRAINT "quiz_answers_option_fk" FOREIGN KEY ("school_id","selected_option_id") REFERENCES "app"."quiz_options"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_answers" ADD CONSTRAINT "quiz_answers_marker_fk" FOREIGN KEY ("school_id","marked_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_assignments" ADD CONSTRAINT "quiz_assignments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_assignments" ADD CONSTRAINT "quiz_assignments_quiz_fk" FOREIGN KEY ("school_id","quiz_id") REFERENCES "app"."quizzes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_assignments" ADD CONSTRAINT "quiz_assignments_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_assignments" ADD CONSTRAINT "quiz_assignments_sce_fk" FOREIGN KEY ("school_id","student_course_enrollment_id") REFERENCES "app"."student_course_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_assignment_fk" FOREIGN KEY ("school_id","quiz_assignment_id") REFERENCES "app"."quiz_assignments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_options" ADD CONSTRAINT "quiz_options_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_options" ADD CONSTRAINT "quiz_options_question_fk" FOREIGN KEY ("school_id","question_id") REFERENCES "app"."quiz_questions"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_questions" ADD CONSTRAINT "quiz_questions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_fk" FOREIGN KEY ("school_id","quiz_id") REFERENCES "app"."quizzes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quizzes" ADD CONSTRAINT "quizzes_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quizzes" ADD CONSTRAINT "quizzes_group_fk" FOREIGN KEY ("school_id","teaching_group_id") REFERENCES "app"."teaching_groups"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."quizzes" ADD CONSTRAINT "quizzes_creator_fk" FOREIGN KEY ("school_id","created_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."submission_attachments" ADD CONSTRAINT "submission_attachments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."submission_attachments" ADD CONSTRAINT "submission_attachments_submission_fk" FOREIGN KEY ("school_id","submission_id") REFERENCES "app"."homework_submissions"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."submission_attachments" ADD CONSTRAINT "submission_attachments_file_fk" FOREIGN KEY ("school_id","file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."assessment_weights" ADD CONSTRAINT "assessment_weights_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."assessment_weights" ADD CONSTRAINT "assessment_weights_policy_fk" FOREIGN KEY ("school_id","policy_version_id") REFERENCES "app"."grading_policy_versions"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_cycles" ADD CONSTRAINT "exam_cycles_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_cycles" ADD CONSTRAINT "exam_cycles_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_cycles" ADD CONSTRAINT "exam_cycles_term_fk" FOREIGN KEY ("school_id","term_id") REFERENCES "app"."terms"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_papers" ADD CONSTRAINT "exam_papers_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_papers" ADD CONSTRAINT "exam_papers_cycle_fk" FOREIGN KEY ("school_id","exam_cycle_id") REFERENCES "app"."exam_cycles"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_papers" ADD CONSTRAINT "exam_papers_course_fk" FOREIGN KEY ("school_id","course_offering_id") REFERENCES "app"."course_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_registrations" ADD CONSTRAINT "exam_registrations_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_registrations" ADD CONSTRAINT "exam_registrations_paper_fk" FOREIGN KEY ("school_id","exam_paper_id") REFERENCES "app"."exam_papers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_registrations" ADD CONSTRAINT "exam_registrations_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_registrations" ADD CONSTRAINT "exam_registrations_enrollment_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_registrations" ADD CONSTRAINT "exam_registrations_sce_fk" FOREIGN KEY ("school_id","student_course_enrollment_id") REFERENCES "app"."student_course_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_registrations" ADD CONSTRAINT "exam_registrations_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_sittings" ADD CONSTRAINT "exam_sittings_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_sittings" ADD CONSTRAINT "exam_sittings_paper_fk" FOREIGN KEY ("school_id","exam_paper_id") REFERENCES "app"."exam_papers"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_sittings" ADD CONSTRAINT "exam_sittings_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_sittings" ADD CONSTRAINT "exam_sittings_room_fk" FOREIGN KEY ("school_id","room_id") REFERENCES "app"."rooms"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exam_sittings" ADD CONSTRAINT "exam_sittings_replaced_by_fk" FOREIGN KEY ("school_id","replaced_by_sitting_id") REFERENCES "app"."exam_sittings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grade_bands" ADD CONSTRAINT "grade_bands_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grade_bands" ADD CONSTRAINT "grade_bands_policy_fk" FOREIGN KEY ("school_id","policy_version_id") REFERENCES "app"."grading_policy_versions"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grading_policy_versions" ADD CONSTRAINT "grading_policy_versions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."mark_revisions" ADD CONSTRAINT "mark_revisions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."mark_revisions" ADD CONSTRAINT "mark_revisions_mark_fk" FOREIGN KEY ("school_id","mark_id") REFERENCES "app"."marks"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."mark_revisions" ADD CONSTRAINT "mark_revisions_changer_fk" FOREIGN KEY ("school_id","changed_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."marks" ADD CONSTRAINT "marks_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."marks" ADD CONSTRAINT "marks_registration_fk" FOREIGN KEY ("school_id","exam_registration_id") REFERENCES "app"."exam_registrations"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."marks" ADD CONSTRAINT "marks_recorder_fk" FOREIGN KEY ("school_id","recorded_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_batches" ADD CONSTRAINT "promotion_batches_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_batches" ADD CONSTRAINT "promotion_batches_source_year_fk" FOREIGN KEY ("school_id","source_academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_batches" ADD CONSTRAINT "promotion_batches_target_year_fk" FOREIGN KEY ("school_id","target_academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_batches" ADD CONSTRAINT "promotion_batches_class_fk" FOREIGN KEY ("school_id","source_class_offering_id") REFERENCES "app"."class_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_batches" ADD CONSTRAINT "promotion_batches_publication_fk" FOREIGN KEY ("school_id","result_publication_id") REFERENCES "app"."result_publications"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_batches" ADD CONSTRAINT "promotion_batches_approver_fk" FOREIGN KEY ("school_id","approved_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_decisions" ADD CONSTRAINT "promotion_decisions_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_decisions" ADD CONSTRAINT "promotion_decisions_batch_fk" FOREIGN KEY ("school_id","batch_id") REFERENCES "app"."promotion_batches"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_decisions" ADD CONSTRAINT "promotion_decisions_source_enrollment_fk" FOREIGN KEY ("school_id","source_enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_decisions" ADD CONSTRAINT "promotion_decisions_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_decisions" ADD CONSTRAINT "promotion_decisions_result_fk" FOREIGN KEY ("school_id","student_result_id") REFERENCES "app"."student_results"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_decisions" ADD CONSTRAINT "promotion_decisions_dest_class_fk" FOREIGN KEY ("school_id","destination_class_offering_id") REFERENCES "app"."class_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_decisions" ADD CONSTRAINT "promotion_decisions_dest_section_fk" FOREIGN KEY ("school_id","destination_section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."promotion_decisions" ADD CONSTRAINT "promotion_decisions_dest_enrollment_fk" FOREIGN KEY ("school_id","destination_enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."result_publications" ADD CONSTRAINT "result_publications_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."result_publications" ADD CONSTRAINT "result_publications_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."result_publications" ADD CONSTRAINT "result_publications_cycle_fk" FOREIGN KEY ("school_id","exam_cycle_id") REFERENCES "app"."exam_cycles"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."result_publications" ADD CONSTRAINT "result_publications_class_fk" FOREIGN KEY ("school_id","class_offering_id") REFERENCES "app"."class_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."result_publications" ADD CONSTRAINT "result_publications_policy_fk" FOREIGN KEY ("school_id","policy_version_id") REFERENCES "app"."grading_policy_versions"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."result_publications" ADD CONSTRAINT "result_publications_supersedes_fk" FOREIGN KEY ("school_id","supersedes_id") REFERENCES "app"."result_publications"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."result_publications" ADD CONSTRAINT "result_publications_publisher_fk" FOREIGN KEY ("school_id","published_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_results" ADD CONSTRAINT "student_results_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_results" ADD CONSTRAINT "student_results_publication_fk" FOREIGN KEY ("school_id","publication_id") REFERENCES "app"."result_publications"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_results" ADD CONSTRAINT "student_results_enrollment_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_results" ADD CONSTRAINT "student_results_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_results" ADD CONSTRAINT "student_results_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subject_results" ADD CONSTRAINT "subject_results_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subject_results" ADD CONSTRAINT "subject_results_student_result_fk" FOREIGN KEY ("school_id","student_result_id") REFERENCES "app"."student_results"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subject_results" ADD CONSTRAINT "subject_results_course_fk" FOREIGN KEY ("school_id","course_offering_id") REFERENCES "app"."course_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bank_accounts" ADD CONSTRAINT "bank_accounts_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bank_import_profiles" ADD CONSTRAINT "bank_import_profiles_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."bank_import_profiles" ADD CONSTRAINT "bank_import_profiles_account_fk" FOREIGN KEY ("school_id","bank_account_id") REFERENCES "app"."bank_accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."document_counters" ADD CONSTRAINT "document_counters_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fee_plan_items" ADD CONSTRAINT "fee_plan_items_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fee_plan_items" ADD CONSTRAINT "fee_plan_items_plan_fk" FOREIGN KEY ("school_id","fee_plan_id") REFERENCES "app"."fee_plans"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fee_plan_items" ADD CONSTRAINT "fee_plan_items_type_fk" FOREIGN KEY ("school_id","fee_type_id") REFERENCES "app"."fee_types"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fee_plans" ADD CONSTRAINT "fee_plans_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fee_plans" ADD CONSTRAINT "fee_plans_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."fee_types" ADD CONSTRAINT "fee_types_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_adjustments" ADD CONSTRAINT "financial_adjustments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_adjustments" ADD CONSTRAINT "financial_adjustments_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_adjustments" ADD CONSTRAINT "financial_adjustments_invoice_fk" FOREIGN KEY ("school_id","invoice_id") REFERENCES "app"."invoices"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_adjustments" ADD CONSTRAINT "financial_adjustments_payment_fk" FOREIGN KEY ("school_id","payment_id") REFERENCES "app"."payments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_adjustments" ADD CONSTRAINT "financial_adjustments_approver_fk" FOREIGN KEY ("school_id","approved_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."import_batches" ADD CONSTRAINT "import_batches_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."import_batches" ADD CONSTRAINT "import_batches_file_fk" FOREIGN KEY ("school_id","file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."import_batches" ADD CONSTRAINT "import_batches_profile_fk" FOREIGN KEY ("school_id","bank_import_profile_id") REFERENCES "app"."bank_import_profiles"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."import_batches" ADD CONSTRAINT "import_batches_creator_fk" FOREIGN KEY ("school_id","created_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."import_rows" ADD CONSTRAINT "import_rows_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."import_rows" ADD CONSTRAINT "import_rows_batch_fk" FOREIGN KEY ("school_id","batch_id") REFERENCES "app"."import_batches"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invoice_lines" ADD CONSTRAINT "invoice_lines_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_fk" FOREIGN KEY ("school_id","invoice_id") REFERENCES "app"."invoices"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invoice_lines" ADD CONSTRAINT "invoice_lines_type_fk" FOREIGN KEY ("school_id","fee_type_id") REFERENCES "app"."fee_types"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_enrollment_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invoices" ADD CONSTRAINT "invoices_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "app"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payment_allocations" ADD CONSTRAINT "payment_allocations_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_fk" FOREIGN KEY ("school_id","payment_id") REFERENCES "app"."payments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_fk" FOREIGN KEY ("school_id","invoice_id") REFERENCES "app"."invoices"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payment_allocations" ADD CONSTRAINT "payment_allocations_creator_fk" FOREIGN KEY ("school_id","created_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_bank_account_fk" FOREIGN KEY ("school_id","bank_account_id") REFERENCES "app"."bank_accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_reversal_of_fk" FOREIGN KEY ("school_id","reversal_of_payment_id") REFERENCES "app"."payments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_import_row_fk" FOREIGN KEY ("school_id","import_row_id") REFERENCES "app"."import_rows"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_recorder_fk" FOREIGN KEY ("school_id","recorded_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "app"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_enrollment_fk" FOREIGN KEY ("school_id","enrollment_id") REFERENCES "app"."student_enrollments"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_plan_fk" FOREIGN KEY ("school_id","fee_plan_id") REFERENCES "app"."fee_plans"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcement_attachments" ADD CONSTRAINT "announcement_attachments_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcement_attachments" ADD CONSTRAINT "announcement_attachments_announcement_fk" FOREIGN KEY ("school_id","announcement_id") REFERENCES "app"."announcements"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcement_attachments" ADD CONSTRAINT "announcement_attachments_file_fk" FOREIGN KEY ("school_id","file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcement_audiences" ADD CONSTRAINT "announcement_audiences_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcement_audiences" ADD CONSTRAINT "announcement_audiences_announcement_fk" FOREIGN KEY ("school_id","announcement_id") REFERENCES "app"."announcements"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcement_audiences" ADD CONSTRAINT "announcement_audiences_class_fk" FOREIGN KEY ("school_id","class_offering_id") REFERENCES "app"."class_offerings"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcement_audiences" ADD CONSTRAINT "announcement_audiences_section_fk" FOREIGN KEY ("school_id","section_id") REFERENCES "app"."sections"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcement_audiences" ADD CONSTRAINT "announcement_audiences_group_fk" FOREIGN KEY ("school_id","teaching_group_id") REFERENCES "app"."teaching_groups"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcements" ADD CONSTRAINT "announcements_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."announcements" ADD CONSTRAINT "announcements_creator_fk" FOREIGN KEY ("school_id","created_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deletion_requests" ADD CONSTRAINT "deletion_requests_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deletion_requests" ADD CONSTRAINT "deletion_requests_account_fk" FOREIGN KEY ("school_id","account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deletion_requests" ADD CONSTRAINT "deletion_requests_requester_fk" FOREIGN KEY ("school_id","requested_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."device_tokens" ADD CONSTRAINT "device_tokens_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."device_tokens" ADD CONSTRAINT "device_tokens_account_fk" FOREIGN KEY ("school_id","account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."device_tokens" ADD CONSTRAINT "device_tokens_session_fk" FOREIGN KEY ("school_id","app_session_id") REFERENCES "app"."app_sessions"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_fk" FOREIGN KEY ("school_id","recipient_id") REFERENCES "app"."notification_recipients"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_device_fk" FOREIGN KEY ("school_id","device_token_id") REFERENCES "app"."device_tokens"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_recipients" ADD CONSTRAINT "notification_recipients_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_recipients" ADD CONSTRAINT "notification_recipients_notification_fk" FOREIGN KEY ("school_id","notification_id") REFERENCES "app"."notifications"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_recipients" ADD CONSTRAINT "notification_recipients_account_fk" FOREIGN KEY ("school_id","account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."report_jobs" ADD CONSTRAINT "report_jobs_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."report_jobs" ADD CONSTRAINT "report_jobs_file_fk" FOREIGN KEY ("school_id","file_id") REFERENCES "app"."files"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."report_jobs" ADD CONSTRAINT "report_jobs_requester_fk" FOREIGN KEY ("school_id","requested_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."retention_holds" ADD CONSTRAINT "retention_holds_school_fk" FOREIGN KEY ("school_id") REFERENCES "app"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."retention_holds" ADD CONSTRAINT "retention_holds_placer_fk" FOREIGN KEY ("school_id","placed_by_account_id") REFERENCES "app"."accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_roles_active_uk" ON "app"."account_roles" USING btree ("school_id","account_id","role") WHERE "app"."account_roles"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_username_uk" ON "app"."accounts" USING btree ("school_id","username");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_auth_user_uk" ON "app"."accounts" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "accounts_status_idx" ON "app"."accounts" USING btree ("school_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "app_sessions_auth_session_uk" ON "app"."app_sessions" USING btree ("auth_session_id");--> statement-breakpoint
CREATE INDEX "app_sessions_account_idx" ON "app"."app_sessions" USING btree ("school_id","account_id");--> statement-breakpoint
CREATE INDEX "audit_events_school_time_idx" ON "app"."audit_events" USING btree ("school_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "app"."audit_events" USING btree ("school_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_object_key_uk" ON "app"."files" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "files_lifecycle_idx" ON "app"."files" USING btree ("school_id","lifecycle");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_key_uk" ON "app"."idempotency_records" USING btree ("school_id","account_id","scope","key");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admins_email_uk" ON "app"."platform_admins" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admins_auth_uk" ON "app"."platform_admins" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_code_uk" ON "app"."schools" USING btree ("code");--> statement-breakpoint
CREATE INDEX "employment_records_teacher_idx" ON "app"."employment_records" USING btree ("school_id","teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_guardians_uk" ON "app"."student_guardians" USING btree ("school_id","student_id","guardian_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_account_uk" ON "app"."students" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_admission_number_uk" ON "app"."students" USING btree ("school_id","admission_number");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_account_uk" ON "app"."teachers" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_employee_number_uk" ON "app"."teachers" USING btree ("school_id","employee_number");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_code_uk" ON "app"."academic_years" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_one_active_uk" ON "app"."academic_years" USING btree ("school_id") WHERE "app"."academic_years"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "class_offerings_uk" ON "app"."class_offerings" USING btree ("school_id","academic_year_id","grade_level_id");--> statement-breakpoint
CREATE INDEX "class_teacher_assignments_teacher_idx" ON "app"."class_teacher_assignments" USING btree ("school_id","teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_offerings_uk" ON "app"."course_offerings" USING btree ("school_id","class_offering_id","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_subjects_uk" ON "app"."curriculum_subjects" USING btree ("school_id","curriculum_version_id","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_versions_uk" ON "app"."curriculum_versions" USING btree ("school_id","grade_level_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_levels_code_uk" ON "app"."grade_levels" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_code_uk" ON "app"."rooms" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "school_calendar_days_date_uk" ON "app"."school_calendar_days" USING btree ("school_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_code_uk" ON "app"."sections" USING btree ("school_id","class_offering_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "streams_code_uk" ON "app"."streams" USING btree ("school_id","code");--> statement-breakpoint
CREATE INDEX "student_course_enrollments_course_idx" ON "app"."student_course_enrollments" USING btree ("school_id","course_offering_id");--> statement-breakpoint
CREATE INDEX "student_course_enrollments_student_idx" ON "app"."student_course_enrollments" USING btree ("school_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_enrollments_student_year_uk" ON "app"."student_enrollments" USING btree ("school_id","student_id","academic_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_enrollments_promotion_uk" ON "app"."student_enrollments" USING btree ("source_promotion_decision_id");--> statement-breakpoint
CREATE INDEX "student_enrollments_class_idx" ON "app"."student_enrollments" USING btree ("school_id","class_offering_id","status");--> statement-breakpoint
CREATE INDEX "student_placements_section_idx" ON "app"."student_placements" USING btree ("school_id","section_id","start_date");--> statement-breakpoint
CREATE INDEX "student_placements_student_idx" ON "app"."student_placements" USING btree ("school_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_code_uk" ON "app"."subjects" USING btree ("school_id","code");--> statement-breakpoint
CREATE INDEX "teacher_assignments_teacher_idx" ON "app"."teacher_assignments" USING btree ("school_id","teacher_id");--> statement-breakpoint
CREATE INDEX "teacher_assignments_group_idx" ON "app"."teacher_assignments" USING btree ("school_id","teaching_group_id");--> statement-breakpoint
CREATE INDEX "tgm_group_idx" ON "app"."teaching_group_memberships" USING btree ("school_id","teaching_group_id");--> statement-breakpoint
CREATE INDEX "tgm_student_idx" ON "app"."teaching_group_memberships" USING btree ("school_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teaching_groups_code_uk" ON "app"."teaching_groups" USING btree ("school_id","course_offering_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_sequence_uk" ON "app"."terms" USING btree ("school_id","academic_year_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_exceptions_uk" ON "app"."lesson_exceptions" USING btree ("school_id","timetable_lesson_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "period_definitions_sequence_uk" ON "app"."period_definitions" USING btree ("school_id","academic_year_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_lessons_group_slot_uk" ON "app"."timetable_lessons" USING btree ("timetable_version_id","weekday","period_definition_id","teaching_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_lessons_teacher_slot_uk" ON "app"."timetable_lessons" USING btree ("timetable_version_id","weekday","period_definition_id","teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_lessons_room_slot_uk" ON "app"."timetable_lessons" USING btree ("timetable_version_id","weekday","period_definition_id","room_id") WHERE "app"."timetable_lessons"."room_id" is not null;--> statement-breakpoint
CREATE INDEX "timetable_lessons_teacher_idx" ON "app"."timetable_lessons" USING btree ("school_id","teacher_id");--> statement-breakpoint
CREATE INDEX "timetable_versions_year_idx" ON "app"."timetable_versions" USING btree ("school_id","academic_year_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_reason_codes_uk" ON "app"."attendance_reason_codes" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_roll_calls_uk" ON "app"."attendance_roll_calls" USING btree ("school_id","section_id","date");--> statement-breakpoint
CREATE INDEX "leave_requests_state_idx" ON "app"."leave_requests" USING btree ("school_id","state","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_code_uk" ON "app"."leave_types" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "student_attendance_student_date_uk" ON "app"."student_attendance" USING btree ("school_id","student_id","date");--> statement-breakpoint
CREATE INDEX "student_attendance_section_date_idx" ON "app"."student_attendance" USING btree ("school_id","section_id","date");--> statement-breakpoint
CREATE INDEX "student_attendance_enrollment_idx" ON "app"."student_attendance" USING btree ("school_id","enrollment_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_attendance_teacher_date_uk" ON "app"."teacher_attendance" USING btree ("school_id","teacher_id","date");--> statement-breakpoint
CREATE INDEX "teacher_attendance_date_idx" ON "app"."teacher_attendance" USING btree ("school_id","date");--> statement-breakpoint
CREATE INDEX "homework_group_due_idx" ON "app"."homework" USING btree ("school_id","teaching_group_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "homework_attachments_uk" ON "app"."homework_attachments" USING btree ("school_id","homework_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "homework_recipients_uk" ON "app"."homework_recipients" USING btree ("school_id","homework_id","student_id");--> statement-breakpoint
CREATE INDEX "homework_recipients_student_idx" ON "app"."homework_recipients" USING btree ("school_id","student_id","completion_state");--> statement-breakpoint
CREATE UNIQUE INDEX "homework_submissions_revision_uk" ON "app"."homework_submissions" USING btree ("school_id","recipient_id","revision");--> statement-breakpoint
CREATE INDEX "learning_materials_group_idx" ON "app"."learning_materials" USING btree ("school_id","teaching_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_answers_uk" ON "app"."quiz_answers" USING btree ("school_id","attempt_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_assignments_uk" ON "app"."quiz_assignments" USING btree ("school_id","quiz_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_number_uk" ON "app"."quiz_attempts" USING btree ("school_id","quiz_assignment_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_options_sequence_uk" ON "app"."quiz_options" USING btree ("school_id","question_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_questions_sequence_uk" ON "app"."quiz_questions" USING btree ("school_id","quiz_id","content_version","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_attachments_uk" ON "app"."submission_attachments" USING btree ("school_id","submission_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_weights_uk" ON "app"."assessment_weights" USING btree ("school_id","policy_version_id","exam_kind");--> statement-breakpoint
CREATE INDEX "exam_cycles_year_idx" ON "app"."exam_cycles" USING btree ("school_id","academic_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_papers_uk" ON "app"."exam_papers" USING btree ("school_id","exam_cycle_id","course_offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_registrations_uk" ON "app"."exam_registrations" USING btree ("school_id","exam_paper_id","student_id");--> statement-breakpoint
CREATE INDEX "exam_sittings_date_idx" ON "app"."exam_sittings" USING btree ("school_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_bands_label_uk" ON "app"."grade_bands" USING btree ("school_id","policy_version_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "grading_policy_versions_uk" ON "app"."grading_policy_versions" USING btree ("school_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "grading_policy_versions_one_active_uk" ON "app"."grading_policy_versions" USING btree ("school_id") WHERE "app"."grading_policy_versions"."state" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "marks_registration_uk" ON "app"."marks" USING btree ("school_id","exam_registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_decisions_uk" ON "app"."promotion_decisions" USING btree ("school_id","batch_id","source_enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_decisions_destination_uk" ON "app"."promotion_decisions" USING btree ("destination_enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_publications_revision_uk" ON "app"."result_publications" USING btree ("school_id","exam_cycle_id","class_offering_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "result_publications_one_published_uk" ON "app"."result_publications" USING btree ("school_id","exam_cycle_id","class_offering_id") WHERE "app"."result_publications"."state" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX "student_results_uk" ON "app"."student_results" USING btree ("school_id","publication_id","enrollment_id");--> statement-breakpoint
CREATE INDEX "student_results_student_idx" ON "app"."student_results" USING btree ("school_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_results_uk" ON "app"."subject_results" USING btree ("school_id","student_result_id","course_offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_plan_items_uk" ON "app"."fee_plan_items" USING btree ("school_id","fee_plan_id","fee_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_types_code_uk" ON "app"."fee_types" USING btree ("school_id","code");--> statement-breakpoint
CREATE INDEX "financial_adjustments_student_idx" ON "app"."financial_adjustments" USING btree ("school_id","student_id");--> statement-breakpoint
CREATE INDEX "import_batches_kind_idx" ON "app"."import_batches" USING btree ("school_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "import_batches_hash_idx" ON "app"."import_batches" USING btree ("school_id","file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "import_rows_number_uk" ON "app"."import_rows" USING btree ("school_id","batch_id","row_number");--> statement-breakpoint
CREATE INDEX "import_rows_fingerprint_idx" ON "app"."import_rows" USING btree ("school_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uk" ON "app"."invoices" USING btree ("school_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_generation_uk" ON "app"."invoices" USING btree ("school_id","generation_key");--> statement-breakpoint
CREATE INDEX "invoices_student_idx" ON "app"."invoices" USING btree ("school_id","student_id","due_date");--> statement-breakpoint
CREATE INDEX "invoices_due_idx" ON "app"."invoices" USING btree ("school_id","status","due_date");--> statement-breakpoint
CREATE INDEX "payment_allocations_invoice_idx" ON "app"."payment_allocations" USING btree ("school_id","invoice_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "app"."payment_allocations" USING btree ("school_id","payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_receipt_uk" ON "app"."payments" USING btree ("school_id","receipt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_bank_txn_uk" ON "app"."payments" USING btree ("school_id","bank_account_id","bank_transaction_id") WHERE "app"."payments"."bank_transaction_id" is not null;--> statement-breakpoint
CREATE INDEX "payments_student_idx" ON "app"."payments" USING btree ("school_id","student_id");--> statement-breakpoint
CREATE INDEX "payments_fingerprint_idx" ON "app"."payments" USING btree ("school_id","fingerprint");--> statement-breakpoint
CREATE INDEX "student_fee_assignments_student_idx" ON "app"."student_fee_assignments" USING btree ("school_id","student_id");--> statement-breakpoint
CREATE INDEX "announcements_published_idx" ON "app"."announcements" USING btree ("school_id","state","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deletion_requests_one_pending_uk" ON "app"."deletion_requests" USING btree ("school_id","account_id") WHERE "app"."deletion_requests"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "deletion_requests_due_idx" ON "app"."deletion_requests" USING btree ("state","recover_until");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_token_uk" ON "app"."device_tokens" USING btree ("school_id","expo_push_token");--> statement-breakpoint
CREATE INDEX "device_tokens_account_idx" ON "app"."device_tokens" USING btree ("school_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_uk" ON "app"."notification_deliveries" USING btree ("school_id","recipient_id","device_token_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_idx" ON "app"."notification_deliveries" USING btree ("status","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipients_uk" ON "app"."notification_recipients" USING btree ("school_id","notification_id","account_id");--> statement-breakpoint
CREATE INDEX "notification_recipients_inbox_idx" ON "app"."notification_recipients" USING btree ("school_id","account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_uk" ON "app"."notifications" USING btree ("school_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "report_jobs_requester_idx" ON "app"."report_jobs" USING btree ("school_id","requested_by_account_id","created_at");--> statement-breakpoint
CREATE INDEX "retention_holds_subject_idx" ON "app"."retention_holds" USING btree ("school_id","subject_type","subject_id");