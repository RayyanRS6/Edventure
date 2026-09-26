# School Management System — Master Product & Development Prompt

You are a **senior software architect, product designer, UX designer, database architect, security engineer, and full-stack developer**.

We are a business developing a **reusable School Management System (SMS)** that will be deployed for multiple schools.

The goal is not to build a simple demo or a collection of CRUD pages. We want to build a **production-ready, scalable, maintainable school management platform** with:

1. **Admin Web App**
2. **Admin Mobile App**
3. **Teacher Mobile App**
4. **Student Mobile App**

The system should be designed so that the same product can eventually be configured and deployed for different schools without rewriting the application.

---

# 1. IMPORTANT INSTRUCTIONS

Before writing code, you MUST:

- Understand the complete requirements.
- Identify missing requirements.
- Identify contradictions or ambiguous requirements.
- Identify edge cases.
- Design the architecture.
- Design the database schema.
- Define relationships between entities.
- Define authentication and authorization.
- Define roles and permissions.
- Define API architecture.
- Define navigation.
- Define dashboard requirements.
- Define notification architecture.
- Define file storage architecture.
- Define caching strategy.
- Define data lifecycle and deletion/recovery behavior.
- Define how academic years, classes, sections, subjects, groups, students, teachers and exams relate to each other.
- Define how the system should work for multiple schools.
- Define what should happen in edge cases.

**Do NOT blindly implement the requirements.**

If a requirement is technically problematic, unnecessarily complicated, insecure, redundant, or architecturally questionable, explain why and propose a better solution.

Do not introduce technologies just because they are popular.

Every technology must have a clear purpose.

---

# 2. PRODUCT GOAL

The platform should allow a school to manage its:

- Students
- Teachers
- Administrators
- Classes
- Sections
- Subjects
- Attendance
- Timetables
- Homework
- Quizzes
- Exams
- Results
- Grades
- Academic progression
- Student profiles
- Teacher profiles
- Leave management
- Fees
- Reports
- Files
- Notifications
- Announcements
- School information
- Teacher assignments
- Class teachers
- Subject allocation
- Student groups/streams
- Historical records

The system should provide different experiences depending on the user's role.

---

# 3. APPLICATIONS

## A. Admin

Admin should have:

- Web application
- Mobile application

The admin is responsible for managing the school.

## B. Teacher

Teachers use:

- Mobile application

## C. Student

Students use:

- Mobile application

The architecture should still allow us to introduce a web interface for teachers or students in the future without rewriting the backend.

---

# 4. MULTI-SCHOOL ARCHITECTURE

This is extremely important.

We are building this as a **business product**, not as software for only one school.

Design the architecture so multiple schools can use the platform.

Each school should have isolated data.

For example:

School A must never be able to access:

- School B students
- School B teachers
- School B fees
- School B attendance
- School B results
- School B files
- School B notifications

Design the database and authorization layer with proper tenant isolation.

Explain whether the recommended architecture should use:

- Shared database with school_id/tenant_id
- Separate database per school
- Hybrid architecture

Choose one and explain why.

---

# 5. RECOMMENDED TECHNOLOGY STACK

We initially considered:

### Backend / Admin Web

Node.js

### Database

Possible options:

- Supabase/PostgreSQL
- Firebase
- Other appropriate solution

### Mobile

React / React Native / Expo

### Authentication

Supabase Auth or another appropriate authentication system.

### Caching

Redis / Upstash

However:

**Do NOT blindly follow these choices.**

Evaluate the technologies and choose the simplest production-ready architecture.

Avoid unnecessary technologies.

For every technology you introduce, explain:

1. Why we need it.
2. What problem it solves.
3. Whether it is actually necessary.
4. What would happen if we removed it.

The final stack should be as simple as possible while remaining scalable and production-ready.

---

# 6. AUTHENTICATION

Students and teachers should NOT be allowed to create their own accounts.

Admins create/manage their accounts.

The admin should be able to:

- Create teacher accounts
- Create student accounts
- Set/reset passwords
- Disable accounts
- Suspend users
- Reactivate users
- Delete users
- Restore deleted users where applicable

Authentication should support:

- Email/username
- Password
- Password reset
- Session management
- Logout
- Device/session management if necessary
- Account status
- Role-based access

Do not store plaintext passwords.

Use proper password hashing/authentication mechanisms.

---

# 7. ROLES AND PERMISSIONS

Design a proper RBAC system.

At minimum:

### Super Admin

For the platform/business itself if required.

### School Admin

Full school management.

### Teacher

Teacher-specific functionality.

### Class Teacher

A teacher with additional permissions for their assigned class.

### Student

Student-specific functionality.

Do not simply hide UI elements.

Permissions must also be enforced on the backend.

Create a clear permissions matrix.

For example:

| Feature | Admin | Class Teacher | Teacher | Student |
|---|---|---|---|---|
| Manage Students | Yes | Limited | No | No |
| Manage Teachers | Yes | No | No | No |
| Take Attendance | Yes | Yes | Yes | No |
| View Class Attendance | Yes | Yes | Limited | Own |
| Enter Marks | Yes | Depending on assignment | Yes | No |
| Schedule Exams | Yes | No | No | No |
| Manage Fees | Yes | No | No | No |

Create the complete permissions matrix yourself.

---

# 8. SCHOOL STRUCTURE

The system needs to support:

School

→ Academic Year

→ Classes

→ Sections

→ Students

→ Subjects

→ Teachers

The architecture must support:

- Multiple academic years
- Multiple classes
- Multiple sections per class
- Students moving between sections
- Students moving between classes
- Historical academic records

Do NOT overwrite historical information when a student moves to another class.

We must preserve historical data.

---

# 9. CLASSES AND SECTIONS

Admins can:

- Create classes
- Edit classes
- Delete/archive classes
- Create sections
- Rename sections
- Move students between sections
- Assign teachers
- Assign subjects

Example:

Grade 7

- Section A
- Section B
- Section C

A student may move:

Grade 7-A → Grade 7-B

The historical record must remain available.

---

# 10. SUBJECT MANAGEMENT

Subjects must be configurable.

Do NOT hard-code subjects.

Some schools may have:

Math
Science
English
Urdu
Islamiyat
Pak Studies
Computer

But another school may have:

English Grammar
English Literature

or:

Urdu Grammar
Urdu Literature

Therefore admins should be able to:

- Create subjects
- Edit subjects
- Archive subjects
- Assign subjects to classes
- Assign subjects to sections
- Assign teachers to subjects
- Configure compulsory/elective subjects

---

# 11. SUBJECT GROUPS / STREAMS

The system must support different academic paths.

For example, Grades 8, 9 and 10 may have:

### Biology Group

- Biology
- Chemistry
- Physics

### Computer Science Group

- Computer Science
- Chemistry
- Physics

Students in the same class may therefore have different subjects.

The architecture must support student-level subject enrollment.

Do NOT assume that every student in a class takes exactly the same subjects.

Admins should control these configurations.

---

# 12. CLASS TEACHERS

Each class/section can have a class teacher.

A class teacher should be able to:

- View their class
- View students
- Take/view attendance
- View attendance statistics
- View relevant student information
- Monitor homework
- Monitor academic performance
- View relevant reports

Only one teacher should be the class teacher for a class/section at a given time.

The system should maintain historical class-teacher assignments.

There is currently a business rule:

> The teacher who has the first class with a particular class may automatically become the class teacher.

Analyze whether this should really be automatic.

If implementing it, define precisely how "first class" is determined and what happens when:

- Multiple teachers have the first period
- Timetable changes
- Teacher changes
- A teacher leaves
- Sections exist
- No teacher is assigned

Do not silently assume an answer.

---

# 13. STUDENT MANAGEMENT

Admin should be able to:

- Create students
- Edit students
- View students
- Search students
- Filter students
- Suspend students
- Reactivate students
- Archive students
- Delete students
- Restore deleted students

Student profiles should contain appropriate information such as:

- Name
- Student ID
- Contact information
- Parent/guardian information
- Date of birth
- Address
- Class
- Section
- Academic history
- Attendance
- Results
- Fees
- Documents
- Status
- Enrollment information

Do not collect unnecessary personal information.

Identify which fields should be required versus optional.

---

# 14. TEACHER MANAGEMENT

Admin should be able to:

- Add teachers
- Edit teachers
- Remove/archive teachers
- Suspend teachers
- Reset passwords
- Assign subjects
- Assign classes
- Assign sections
- Assign timetable periods
- Assign class teacher role

Teacher profiles should support appropriate information such as:

- Name
- Contact information
- Employee ID
- Subjects
- Classes
- Qualifications
- Employment information
- Salary information where required
- Joining date
- Status
- Leave history

Do not expose salary information to teachers or students.

---

# 15. DELETION AND RECOVERY

When an admin deletes a student or teacher:

Do NOT immediately permanently delete the record.

Flow:

1. Admin clicks Delete.
2. Show confirmation.
3. Explain that the record will be recoverable for 30 days.
4. Ask for confirmation again.
5. Mark record as deleted/archived.
6. Keep it recoverable for 30 days.
7. After 30 days, permanently delete/anonymize according to the retention policy.

Design:

- Soft deletion
- Recovery
- Permanent deletion
- Audit logging

Historical academic records may need to remain even after account deletion.

Think carefully about referential integrity.

---

# 16. ATTENDANCE

The system should support:

- Student attendance
- Teacher attendance
- Daily attendance
- Class attendance
- Individual attendance
- Attendance statistics
- Attendance reports
- Monthly reports
- Date-range reports
- Leave-related attendance

Teachers should be able to take attendance for their assigned classes.

Class teachers should be able to see attendance statistics for their students.

Admins should be able to see:

- Class attendance
- Student attendance
- Teacher attendance
- Attendance reports

Define statuses such as:

- Present
- Absent
- Late
- Excused

Determine whether these should be configurable.

Prevent duplicate attendance records.

---

# 17. LEAVE MANAGEMENT

Implement leave management for appropriate users.

Support:

- Leave requests
- Leave approval/rejection
- Leave status
- Leave history
- Leave types
- Leave reports

Define the workflow for:

Teacher leave

Student leave

Admin approval

Consider whether students should submit requests themselves or whether parents/guardians should eventually be supported.

---

# 18. TIMETABLE

The system should support:

- Classes
- Subjects
- Teachers
- Rooms if needed
- Days
- Periods
- Sections

Admins should manage timetables.

Teachers should see their timetable.

Students should see their timetable.

Prevent scheduling conflicts such as:

A teacher being assigned to two classes at the same time.

A class being assigned two subjects at the same time.

A room being assigned twice at the same time, if rooms are supported.

Design a proper timetable data model.

---

# 19. HOMEWORK

Teachers should be able to:

- Create homework
- Assign homework to class/section
- Assign homework to subject
- Set due dates
- Attach files
- Edit homework
- Delete/archive homework

Students should be able to:

- View homework
- Filter homework
- View due dates
- Access attachments
- See completed/pending status

If implementing submissions, support:

- Student submission
- File upload
- Submission timestamp
- Late submission
- Teacher feedback
- Grade/score

Clearly separate MVP features from future features.

---

# 20. QUIZZES

Teachers should be able to create quizzes.

Support:

- Questions
- Multiple choice
- Short answers if appropriate
- Marks
- Time limits if needed
- Start/end dates
- Results

Students should be able to:

- View available quizzes
- Attempt quizzes
- View results when released

Do not over-engineer the quiz system unless necessary.

---

# 21. EXAMS

Only admins should be able to:

- Create exams
- Schedule exams
- Define exam types
- Define subjects
- Define exam dates
- Manage exam schedules

Teachers should enter marks only for subjects/classes they are assigned to.

Admins should oversee entered marks.

Implement appropriate validation.

For example:

- Prevent marks above maximum marks.
- Prevent unauthorized teachers from editing marks.
- Track who entered/modified marks.
- Maintain audit history.

---

# 22. RESULTS AND GRADING

Support:

- Marks
- Percentage
- Grades
- GPA if required
- Subject results
- Overall results
- Exam results
- Report cards

The grading system should be configurable because different schools may use different grading rules.

Do NOT hard-code one grading system.

Admins should configure:

- Grade boundaries
- Passing marks
- Maximum marks
- Weightage
- Exam types

---

# 23. STUDENT PROMOTION

After final examinations, students may:

- Pass and move to next class
- Fail and remain in the same class

The system should support automatic promotion based on configured rules.

However, admins must be able to manually override promotion decisions.

The promotion system should generate a historical academic record.

Example:

2025–2026:

Grade 7-A

Result: Passed

2026–2027:

Grade 8-B

Never overwrite the old record.

---

# 24. FEES

The school may provide bank/payment records.

Admin should be able to import/update fee records.

The system should track:

- Student
- Fee amount
- Due date
- Payment status
- Payment date
- Outstanding amount
- Academic year
- Fee type
- Transaction/reference information

Support:

- Paid
- Unpaid
- Partially paid
- Overdue

Admin should be able to see students who have not paid.

Students should receive notifications for unpaid fees.

Define the bank import process.

Support CSV where appropriate.

Do NOT assume direct bank API integration unless the bank provides an API.

---

# 25. REPORTS

Admin should be able to generate reports for:

- Attendance
- Students
- Teachers
- Exams
- Results
- Fees
- Leave
- Academic performance
- Class performance
- Teacher performance where appropriate

Reports should support:

- Filtering
- Date ranges
- Class
- Section
- Subject
- Academic year

Allow exports such as:

- CSV
- PDF where appropriate

Avoid generating huge reports synchronously if the data is large.

---

# 26. SEARCH AND FILTERING

Admin should be able to search/filter students based on:

- Name
- Student ID
- Class
- Section
- Percentage
- Grades
- Attendance
- Fee status
- Academic year
- Student status

The architecture should allow additional filters later.

Design efficient database queries.

Do not fetch every student into the frontend just to filter them.

---

# 27. FILE MANAGEMENT

Teachers should be able to upload files such as:

- PDFs
- Notes
- Study material
- Documents

Students should be able to access files they are authorized to access.

Use proper object/file storage rather than storing files directly inside the database.

Define:

- File size limits
- Allowed file types
- Access permissions
- File ownership
- Deletion
- Storage organization

---

# 28. NOTIFICATIONS

Support push notifications.

Admin should be able to broadcast notifications to:

- All students
- All teachers
- Specific classes
- Specific sections
- Specific users

Examples:

- Holidays
- Emergency announcements
- Fee reminders
- Exam notifications
- Homework notifications
- School announcements

Students and teachers should have a notification center.

Define:

- Read/unread
- Push notification
- In-app notification
- Notification history

Do not send unnecessary notifications.

---

# 29. DASHBOARDS

The dashboard is extremely important.

Do NOT make the dashboard overcrowded.

It should provide a simple overview of the most important information.

## Admin Dashboard

Potential widgets:

- Total students
- Total teachers
- Attendance overview
- Today's timetable
- Upcoming exams
- Pending fees
- Recent announcements
- Leave requests
- Academic overview
- Important alerts

## Teacher Dashboard

Potential widgets:

- Today's classes
- Today's timetable
- Pending attendance
- Pending homework
- Upcoming exams
- Notifications
- Assigned classes

## Student Dashboard

Potential widgets:

- Today's timetable
- Homework
- Upcoming quizzes/exams
- Attendance
- Recent results
- Notifications
- Fee status

The final dashboard should be clean, simple and visually understandable.

Do not put every feature on the dashboard.

---

# 30. UI/UX

The UI should be:

- Modern
- Clean
- Professional
- Simple
- Accessible
- Responsive
- Consistent

Avoid:

- Excessive cards
- Excessive colors
- Huge dashboards
- Unnecessary animations
- Confusing navigation
- Deeply nested menus

Use a consistent design system.

Define:

- Typography
- Spacing
- Components
- Buttons
- Forms
- Tables
- Cards
- Modals
- Alerts
- Empty states
- Loading states
- Error states

Mobile UX must be designed specifically for mobile rather than treating it as a small desktop screen.

---

# 31. NAVIGATION

Create proper routes/pages/screens.

Define navigation separately for:

### Admin Web

### Admin Mobile

### Teacher Mobile

### Student Mobile

Use meaningful routes/slugs.

Example:

/admin/dashboard

/admin/students

/admin/students/:studentId

/admin/teachers

/admin/classes

/admin/subjects

/admin/exams

/admin/results

/admin/fees

/admin/reports

etc.

Do not expose sensitive IDs unnecessarily in URLs.

---

# 32. DATABASE DESIGN

Before implementation, create a complete database ERD.

Potential entities include:

- Schools
- AcademicYears
- Users
- Roles
- Permissions
- Students
- Teachers
- Classes
- Sections
- Subjects
- SubjectAssignments
- StudentSubjectEnrollments
- TeacherAssignments
- ClassTeacherAssignments
- Timetables
- Attendance
- LeaveRequests
- Homework
- HomeworkSubmissions
- Quizzes
- Exams
- ExamSchedules
- Marks
- Grades
- Promotions
- Fees
- FeePayments
- Files
- Notifications
- Announcements
- AuditLogs

Do not blindly create every table above.

Determine the actual normalized schema.

Explain relationships, indexes, constraints and unique keys.

---

# 33. DATA INTEGRITY

The backend must enforce business rules.

Examples:

- A student cannot belong to two sections for the same academic period.
- A teacher cannot be class teacher for two sections if the business rule forbids it.
- Duplicate attendance records must be prevented.
- Marks cannot exceed maximum marks.
- Unauthorized teachers cannot modify marks.
- Students cannot access another student's data.
- Teachers cannot access unrelated classes.
- Deleted users cannot authenticate.
- Archived academic records cannot be accidentally modified.

Create database constraints where possible rather than relying entirely on frontend validation.

---

# 34. AUDIT LOGGING

Important actions should be logged.

Examples:

- Student created
- Student deleted
- Student restored
- Teacher created
- Password changed
- Marks modified
- Fee updated
- Exam scheduled
- Student promoted
- Role changed
- Class teacher changed

Audit logs should contain appropriate information such as:

- Actor
- Action
- Entity
- Entity ID
- Timestamp
- Relevant metadata

Do not log sensitive information such as passwords.

---

# 35. SECURITY

Treat security as a first-class requirement.

Consider:

- Authentication
- Authorization
- RBAC
- Tenant isolation
- Input validation
- SQL injection
- XSS
- CSRF where relevant
- Rate limiting
- File upload security
- API security
- Secure secrets
- Environment variables
- Password security
- Session security
- Access tokens
- Refresh tokens
- Sensitive data exposure

Students and teachers must never be able to bypass frontend restrictions by calling APIs directly.

---

# 36. CACHING

We mentioned Redis/Upstash.

Do not automatically add Redis everywhere.

Identify which operations actually benefit from caching.

Potential candidates:

- Timetables
- Frequently accessed school configuration
- Subject lists
- Dashboard aggregates
- Public/non-sensitive configuration

Do NOT cache sensitive or frequently changing data unnecessarily.

For every Redis cache, define:

- Cache key
- TTL
- Invalidation strategy
- Source of truth

The database remains the source of truth.

---

# 37. API ARCHITECTURE

Design clean APIs.

Define:

- Authentication endpoints
- Student endpoints
- Teacher endpoints
- Class endpoints
- Subject endpoints
- Attendance endpoints
- Homework endpoints
- Exam endpoints
- Result endpoints
- Fee endpoints
- Notification endpoints
- Report endpoints

Use proper HTTP semantics.

Implement:

- Validation
- Pagination
- Filtering
- Sorting
- Authorization
- Error handling

Do not create hundreds of unnecessary endpoints.

---

# 38. PAGINATION

All potentially large datasets must be paginated.

Examples:

- Students
- Teachers
- Attendance
- Notifications
- Audit logs
- Fees
- Results

Do not load thousands of records into the frontend at once.

---

# 39. IMPORT / EXPORT

Admin should be able to bulk import:

- Students
- Teachers

Support CSV initially.

Provide downloadable templates.

Templates must contain correct column names.

Example:

Student import:

student_id
first_name
last_name
email
phone
class
section
etc.

Validate imports before committing them.

Show:

- Valid rows
- Invalid rows
- Errors
- Duplicate records
- Missing fields

Allow admins to correct errors.

Do not partially import data without clearly informing the admin.

---

# 40. ERROR HANDLING

Every application should have:

- Loading states
- Empty states
- Error states
- Retry states
- Validation errors
- Network error handling

Never show raw stack traces to users.

Create standardized API error responses.

---

# 41. LOGGING AND MONITORING

Define appropriate logging.

Do not log sensitive information.

Prepare architecture for:

- Error monitoring
- API monitoring
- Database monitoring
- Performance monitoring

---

# 42. TESTING

Do not consider the project complete without testing.

Implement appropriate:

### Unit tests

For business logic.

### Integration tests

For APIs/database operations.

### End-to-end tests

For important flows.

Important flows include:

- Login
- Student creation
- Teacher creation
- Attendance
- Homework
- Exam creation
- Mark entry
- Result calculation
- Student promotion
- Fee import
- Notifications
- File access
- Role permissions

---

# 43. PERFORMANCE

Design for a school with potentially:

- Thousands of students
- Hundreds of teachers
- Multiple sections
- Multiple academic years

Avoid:

- N+1 queries
- Huge API responses
- Unnecessary database requests
- Unnecessary client-side processing
- Excessive API calls

Use proper indexes.

---

# 44. MOBILE APP

Use React Native with Expo if that is the most appropriate architecture.

The mobile application should support:

- Android
- iOS

Consider:

- Push notifications
- Offline/poor network behavior where useful
- Image/file uploads
- Secure token storage
- Loading states
- Network failures
- Deep linking if necessary

Do not attempt to make every feature work offline unless there is a genuine business requirement.

---

# 45. ADMIN WEB

The admin web app should be optimized for:

- Desktop
- Laptop
- Tablet

It should provide powerful management features without becoming complicated.

Tables should support:

- Search
- Filters
- Sorting
- Pagination
- Bulk actions where appropriate

---

# 46. DATA RETENTION

Define retention policies for:

- Deleted users
- Academic records
- Attendance
- Fees
- Results
- Audit logs
- Files

Do not permanently delete information that is required for historical academic/legal/business records without first defining the consequences.

---

# 47. EDGE CASES

You MUST identify and handle edge cases.

At minimum consider:

- Student changes section
- Student changes class
- Student repeats year
- Student transfers school
- Student leaves school
- Teacher leaves school
- Teacher changes subject
- Teacher changes class
- Class teacher changes
- Section is deleted
- Subject is removed
- Student changes academic group
- Student fails one subject
- Student fails final examination
- Student has no attendance
- Teacher enters marks twice
- Teacher attempts to edit another teacher's marks
- Duplicate students
- Duplicate teacher records
- Duplicate attendance
- Duplicate fee payment
- Imported CSV contains invalid data
- Imported CSV contains duplicate records
- User account is deleted while historical records exist
- School changes grading system
- Academic year ends
- New academic year begins
- Student is promoted manually
- Student is not promoted
- Exam is rescheduled
- Teacher is absent
- Timetable conflict
- File is deleted
- Notification fails
- Mobile device has no internet

Create a dedicated edge-case analysis.

---

# 48. UX FLOWS

Before coding, document important flows.

For example:

### Student Creation

Admin
→ Students
→ Add Student
→ Enter Information
→ Assign Academic Year
→ Assign Class
→ Assign Section
→ Assign Subjects if necessary
→ Create Account
→ Set/Generate Password
→ Confirmation

### Attendance

Teacher
→ Today's Classes
→ Select Class
→ Select Subject/Period
→ Student List
→ Mark Attendance
→ Review
→ Submit
→ Confirmation

### Exam Results

Admin
→ Exams
→ Create Exam
→ Schedule
→ Teachers Enter Marks
→ Admin Reviews
→ Publish Results
→ Students View Results

### Promotion

Admin
→ Final Results
→ Promotion Rules
→ Generate Promotion Candidates
→ Review
→ Approve
→ Create Next Academic Year Enrollment

Design all major flows.

---

# 49. MVP VS FUTURE FEATURES

Do not attempt to build everything at once.

Divide functionality into:

### Phase 1 — MVP

Only features necessary to launch the system.

### Phase 2

Important improvements.

### Phase 3

Advanced functionality.

Clearly explain why each feature belongs to each phase.

---

# 50. DEVELOPMENT ORDER

Do not randomly build pages.

Recommended sequence:

1. Product requirements
2. Architecture
3. Database schema
4. Authentication
5. Authorization
6. School/tenant structure
7. Academic year structure
8. Classes/sections
9. Users
10. Subjects
11. Teacher assignments
12. Student enrollment
13. Timetable
14. Attendance
15. Homework
16. Exams/results
17. Promotion
18. Fees
19. Notifications
20. Files
21. Reports
22. Dashboards
23. Import/export
24. Testing
25. Security audit
26. Performance optimization
27. Deployment

Adjust this order if you have a better architectural reason.

---

# 51. REQUIRED OUTPUT BEFORE CODING

Before writing actual application code, provide the following:

## A. Architecture Overview

Explain the complete architecture.

## B. Technology Stack

List every technology and explain why it is required.

Also list technologies you deliberately decided NOT to use and why.

## C. Database Schema

Provide complete schema.

## D. ER Diagram

Provide Mermaid ER diagram.

## E. Permission Matrix

Provide complete role/permission matrix.

## F. API Specification

List major APIs and their responsibilities.

## G. Application Navigation

Show:

Admin Web navigation

Admin Mobile navigation

Teacher Mobile navigation

Student Mobile navigation

## H. User Flows

Document the most important workflows.

## I. Edge Cases

Document important edge cases and how they are handled.

## J. Security Model

Explain authentication, authorization, tenant isolation and data protection.

## K. Caching Strategy

Explain whether Redis/Upstash is actually necessary and where it will be used.

## L. File Storage

Explain where files are stored and how access is controlled.

## M. MVP Roadmap

Divide features into MVP, Phase 2 and Phase 3.

---

# 52. IMPORTANT ARCHITECTURAL PRINCIPLE

The application should be:

**Simple enough to maintain, but robust enough to scale.**

Do not create complexity just to make the system look sophisticated.

Avoid:

- Microservices unless genuinely necessary
- Multiple databases without justification
- Multiple backend frameworks
- Unnecessary state-management libraries
- Unnecessary caching
- Duplicate APIs
- Duplicate components
- Over-engineered abstractions
- Excessive dependencies

Prefer:

- One clear backend architecture
- One primary database
- One authentication system
- One file storage solution
- One notification strategy
- Reusable components
- Clear modules
- Strong typing
- Strong validation
- Clear separation of concerns

---

# 53. CODE QUALITY REQUIREMENTS

When implementation begins:

- Use clear naming.
- Use modular architecture.
- Avoid giant files.
- Avoid duplicate code.
- Avoid hard-coded business rules.
- Avoid magic numbers.
- Use environment variables for secrets/configuration.
- Validate all external input.
- Keep frontend and backend responsibilities separate.
- Keep business logic out of UI components.
- Use reusable components.
- Add appropriate comments only where necessary.
- Do not add comments explaining obvious code.
- Keep dependencies minimal.

---

# 54. DO NOT ASSUME

If something is unclear, explicitly identify it.

For example:

> "The requirement says students can be suspended, but it does not define what suspension means. We need to determine whether a suspended student can log in, whether they remain enrolled, and whether attendance continues."

Create a section:

# Questions / Decisions Required

List every important decision that the business needs to make.

Do not silently invent business rules.

Where a reasonable default is needed, clearly label it as:

**Recommended Default**

---

# 55. FINAL REQUIREMENT

Think about this project as if you are going to maintain it for the next **5–10 years**.

We do not want a project that works only for the initial demo.

We want a system that:

- Can support multiple schools
- Can support thousands of users
- Can support multiple academic years
- Preserves historical data
- Is secure
- Is maintainable
- Is easy for developers to understand
- Is easy for school administrators to use
- Can evolve with future requirements
- Does not depend on unnecessary technologies

Most importantly:

**Do not start coding until the architecture and requirements have been properly analyzed.**

First give me the complete architecture/design document described above.

After I approve the architecture, we will proceed with implementation step by step.