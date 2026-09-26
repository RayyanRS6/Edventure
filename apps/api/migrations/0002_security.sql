-- Security, integrity and tenant isolation that Drizzle cannot express.
--
-- Tenant context is set per transaction by the backend with set_config(..., is_local => true):
--   app.school_id   verified school of the authenticated account
--   app.account_id  acting account
--   app.roles       comma-separated active roles (school_admin,teacher,student)
-- Missing context resolves to NULL and therefore denies access.

CREATE OR REPLACE FUNCTION app.current_school_id() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(current_setting('app.school_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.current_account_id() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(current_setting('app.account_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.current_has_role(p_role text) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT p_role = ANY (string_to_array(coalesce(nullif(current_setting('app.roles', true), ''), ''), ','))
$$;
--> statement-breakpoint

-- Row-level security on every application table; tenant policy on every table with school_id.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;

  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'app' AND c.column_name = 'school_id' AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON app.%I TO edventure_app USING (school_id = app.current_school_id()) WITH CHECK (school_id = app.current_school_id())',
      r.table_name
    );
  END LOOP;
END
$$;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON app.schools TO edventure_app
  USING (id = app.current_school_id()) WITH CHECK (id = app.current_school_id());
--> statement-breakpoint
-- Salary records: in addition to tenant isolation, only school administrators may see or change them.
CREATE POLICY compensation_admin_only ON app.compensation_records AS RESTRICTIVE TO edventure_app
  USING (app.current_has_role('school_admin')) WITH CHECK (app.current_has_role('school_admin'));
--> statement-breakpoint

-- Grants. The application role gets DML only; no DDL, no ownership, no BYPASSRLS.
REVOKE ALL ON SCHEMA app FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO edventure_app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA extensions TO edventure_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO edventure_app;
--> statement-breakpoint
REVOKE ALL ON app.platform_admins, app.platform_support_grants FROM edventure_app;
--> statement-breakpoint
REVOKE INSERT, DELETE ON app.schools FROM edventure_app;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON app.audit_events FROM edventure_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO edventure_app;
--> statement-breakpoint
-- Supabase exposes `anon`/`authenticated` through its Data API. Make sure they can never reach app data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA app FROM anon';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA app FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA app FROM authenticated';
  END IF;
END
$$;
--> statement-breakpoint

-- Narrow pre-tenant lookups. SECURITY DEFINER so they can run before tenant context exists;
-- each returns only what the login/session step needs.
CREATE OR REPLACE FUNCTION app.resolve_login(p_school_code text, p_username text)
RETURNS TABLE (
  account_id uuid,
  school_id uuid,
  auth_user_id uuid,
  account_status app.account_status,
  provisioning_state app.provisioning_state,
  school_status app.school_status
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT a.id, a.school_id, a.auth_user_id, a.status, a.provisioning_state, s.status
  FROM app.accounts a
  JOIN app.schools s ON s.id = a.school_id
  WHERE s.code = upper(p_school_code) AND a.username = lower(p_username)
$$;
--> statement-breakpoint
-- Resolves everything the per-request authorization step needs in one round trip.
CREATE OR REPLACE FUNCTION app.resolve_session(p_auth_session_id text)
RETURNS TABLE (
  app_session_id uuid,
  school_id uuid,
  account_id uuid,
  auth_user_id uuid,
  session_revoked boolean,
  mfa_verified_at timestamptz,
  last_seen_at timestamptz,
  client app.client_kind,
  account_status app.account_status,
  must_change_password boolean,
  mfa_required boolean,
  locale app.locale,
  roles text[],
  student_id uuid,
  teacher_id uuid,
  school_status app.school_status,
  timezone text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT s.id, s.school_id, s.account_id, a.auth_user_id, s.revoked_at IS NOT NULL, s.mfa_verified_at, s.last_seen_at, s.client,
         a.status, a.must_change_password, a.mfa_required, a.locale,
         coalesce((SELECT array_agg(r.role::text ORDER BY r.role::text) FROM app.account_roles r
                   WHERE r.school_id = s.school_id AND r.account_id = a.id AND r.revoked_at IS NULL), '{}'::text[]),
         (SELECT st.id FROM app.students st WHERE st.school_id = s.school_id AND st.account_id = a.id),
         (SELECT te.id FROM app.teachers te WHERE te.school_id = s.school_id AND te.account_id = a.id),
         sc.status, sc.timezone
  FROM app.app_sessions s
  JOIN app.accounts a ON a.school_id = s.school_id AND a.id = s.account_id
  JOIN app.schools sc ON sc.id = s.school_id
  WHERE s.auth_session_id = p_auth_session_id
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.active_school_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT id FROM app.schools WHERE status = 'active'
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.resolve_login(text, text), app.resolve_session(text), app.active_school_ids() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
  app.resolve_login(text, text),
  app.resolve_session(text),
  app.active_school_ids(),
  app.current_school_id(),
  app.current_account_id(),
  app.current_has_role(text)
TO edventure_app;
--> statement-breakpoint

-- updated_at maintenance.
CREATE OR REPLACE FUNCTION app.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'app' AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER touch_updated_at BEFORE UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()',
      r.table_name
    );
  END LOOP;
END
$$;
--> statement-breakpoint

-- Effective-dated ranges use [start, end). These exclusions stop overlapping history.
ALTER TABLE app.student_placements ADD CONSTRAINT student_placements_no_overlap
  EXCLUDE USING gist (school_id WITH =, enrollment_id WITH =, daterange(start_date, end_date, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE app.student_stream_assignments ADD CONSTRAINT student_stream_assignments_no_overlap
  EXCLUDE USING gist (school_id WITH =, enrollment_id WITH =, daterange(start_date, end_date, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE app.student_course_enrollments ADD CONSTRAINT student_course_enrollments_no_overlap
  EXCLUDE USING gist (school_id WITH =, enrollment_id WITH =, course_offering_id WITH =, daterange(start_date, end_date, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE app.teaching_group_memberships ADD CONSTRAINT tgm_no_overlap
  EXCLUDE USING gist (school_id WITH =, teaching_group_id WITH =, student_course_enrollment_id WITH =, daterange(start_date, end_date, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE app.teacher_assignments ADD CONSTRAINT teacher_assignments_no_overlap
  EXCLUDE USING gist (school_id WITH =, teacher_id WITH =, teaching_group_id WITH =, daterange(start_date, end_date, '[)') WITH &&);
--> statement-breakpoint
-- One active class teacher per section. A teacher may lead several sections.
ALTER TABLE app.class_teacher_assignments ADD CONSTRAINT class_teacher_one_per_section
  EXCLUDE USING gist (school_id WITH =, section_id WITH =, daterange(start_date, end_date, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE app.employment_records ADD CONSTRAINT employment_records_no_overlap
  EXCLUDE USING gist (school_id WITH =, teacher_id WITH =, daterange(start_date, end_date, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE app.compensation_records ADD CONSTRAINT compensation_records_no_overlap
  EXCLUDE USING gist (school_id WITH =, teacher_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE app.student_fee_assignments ADD CONSTRAINT student_fee_assignments_no_overlap
  EXCLUDE USING gist (school_id WITH =, student_id WITH =, fee_plan_id WITH =, daterange(start_date, end_date, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE app.grade_bands ADD CONSTRAINT grade_bands_no_overlap
  EXCLUDE USING gist (school_id WITH =, policy_version_id WITH =, numrange(min_percentage, max_percentage, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE app.timetable_versions ADD CONSTRAINT timetable_versions_published_no_overlap
  EXCLUDE USING gist (school_id WITH =, academic_year_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&)
  WHERE (status = 'published');
--> statement-breakpoint

-- Scores cannot exceed the paper maximum (also validated by the service inside the transaction).
CREATE OR REPLACE FUNCTION app.marks_check_max() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_max numeric;
BEGIN
  IF NEW.score IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT p.max_marks INTO v_max
  FROM app.exam_registrations r
  JOIN app.exam_papers p ON p.id = r.exam_paper_id AND p.school_id = r.school_id
  WHERE r.id = NEW.exam_registration_id AND r.school_id = NEW.school_id;
  IF v_max IS NULL OR NEW.score > v_max THEN
    RAISE EXCEPTION 'score % exceeds paper maximum %', NEW.score, v_max
      USING ERRCODE = '23514', CONSTRAINT = 'marks_score_max';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER marks_check_max BEFORE INSERT OR UPDATE ON app.marks
  FOR EACH ROW EXECUTE FUNCTION app.marks_check_max();
--> statement-breakpoint

-- Invoice totals are derived from their sources and kept consistent by triggers.
-- The invoices_amounts CHECK then guarantees allocations + adjustments never exceed the charge.
CREATE OR REPLACE FUNCTION app.refresh_invoice_amounts(p_school_id uuid, p_invoice_id uuid) RETURNS void
LANGUAGE sql AS $$
  UPDATE app.invoices i SET
    total_amount = coalesce((SELECT sum(l.amount) FROM app.invoice_lines l
                             WHERE l.school_id = i.school_id AND l.invoice_id = i.id), 0),
    paid_amount = coalesce((SELECT sum(a.amount) FROM app.payment_allocations a
                            WHERE a.school_id = i.school_id AND a.invoice_id = i.id AND a.reversed_at IS NULL), 0),
    adjusted_amount = coalesce((SELECT sum(f.amount) FROM app.financial_adjustments f
                                WHERE f.school_id = i.school_id AND f.invoice_id = i.id AND f.reversed_at IS NULL
                                  AND f.kind IN ('waiver', 'discount', 'write_off')), 0)
  WHERE i.school_id = p_school_id AND i.id = p_invoice_id
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.invoice_source_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.invoice_id IS NOT NULL THEN
    PERFORM app.refresh_invoice_amounts(OLD.school_id, OLD.invoice_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.invoice_id IS NOT NULL THEN
    PERFORM app.refresh_invoice_amounts(NEW.school_id, NEW.invoice_id);
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER invoice_lines_refresh AFTER INSERT OR UPDATE OR DELETE ON app.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION app.invoice_source_changed();
--> statement-breakpoint
CREATE TRIGGER financial_adjustments_refresh AFTER INSERT OR UPDATE OR DELETE ON app.financial_adjustments
  FOR EACH ROW EXECUTE FUNCTION app.invoice_source_changed();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.payment_allocations_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_payment_amount numeric;
  v_payment_status app.payment_status;
  v_allocated numeric;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM app.refresh_invoice_amounts(OLD.school_id, OLD.invoice_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    -- Serialize allocations against the same payment, then re-read committed totals.
    SELECT amount, status INTO v_payment_amount, v_payment_status
    FROM app.payments WHERE school_id = NEW.school_id AND id = NEW.payment_id FOR UPDATE;
    IF NEW.reversed_at IS NULL AND v_payment_status <> 'posted' THEN
      RAISE EXCEPTION 'cannot allocate a reversed payment' USING ERRCODE = '23514', CONSTRAINT = 'payment_allocations_posted';
    END IF;
    SELECT coalesce(sum(amount), 0) INTO v_allocated FROM app.payment_allocations
    WHERE school_id = NEW.school_id AND payment_id = NEW.payment_id AND reversed_at IS NULL;
    IF v_allocated > v_payment_amount THEN
      RAISE EXCEPTION 'allocations % exceed payment amount %', v_allocated, v_payment_amount
        USING ERRCODE = '23514', CONSTRAINT = 'payment_allocations_within_payment';
    END IF;
    PERFORM app.refresh_invoice_amounts(NEW.school_id, NEW.invoice_id);
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER payment_allocations_changed AFTER INSERT OR UPDATE OR DELETE ON app.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION app.payment_allocations_changed();
--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO edventure_app;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app.resolve_login(text, text), app.resolve_session(text), app.active_school_ids() FROM PUBLIC;
