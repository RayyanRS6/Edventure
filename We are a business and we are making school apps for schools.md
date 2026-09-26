We are a business and we are making school apps for schools

I want to create a school app

I want you to write me a detailed prompt

And we want to create 3 views: one for teachers, one for students and one for Admin

- The admin view will be available on both mobile and web
- The student and teacher will be on mobile view only

**TECH STACK:**

The web app will be in node.js (anything for database firebase or supabase or anything that you think might be best) for simplicity and the mobile app will be in react js (or react native idk) and expo so it has support for both android and IOS. The login can also be handled by supabase as the admin will be giving credentials to teachers and students, they (students and teachers) will not be allowed to create accounts on their own. Use redis and upstash so we don't have to hit all the queries to database.

**FEATURES:**

You must think of all the required features.

attendance, homework, quizzes, timetable, grades, file sharing (teacher can upload PDFs for students and students can access them) these are just the features that I can think on top of my head obviously there can be more.

There should also be a feature for class teachers. And usually in our school systems the class teacher takes the attendance for the whole class so the class teacher should be able to view the attendance statistics of their students. Admin can change the role of teacher to class teacher. only one teacher can be the class teacher of one class and by default the teacher who has the first class with a particular class will be the class teacher of that class.

The admin should have the access to set the password of every student and teacher.

We should be able to add delete edit the students and teachers. But remember that the deleted data of students and teachers should be available for 30 days and it should be prompted that are you sure you want to delete this data (something like that) and then after they click yes then ask again and tell them that the data will be deleted after 30 days until then it is recoverable.

The student can be Suspended etc as well.

Also, the timetable should be followed and if the student passes or fails the final exam then he/she will also be moved to the next class or stay in the same class.

But admin should have this access to move the child to next class.

Promote students to the new class automatically after final examinations and result basis.

Classes can also have multiple sections, and the admin should have access to changing sections of the students.

Batch import and export along with templates (the proper heading so that while importing data we don't make mistakes) for teachers and admins and CSV support.

The teacher and students should have proper profiles

The students should have proper profiles for the contact information and the school profile as well for keeping the record overall on how he or she is performing. Same goes for the teachers and salary and everything

The pages should have proper slugs and pages to navigate.

For classes such as 8th 9th 10th the sections have separate subject bio and computer.

Admin should have the options to add or remove subjects and allocate subjects to specific classes so for example classes one to seven have fixed subjects including math science English pak studies islamiyat computer urdu etc but it should also have the option to add additional subjects as well in case schools have different subject some schools divide English into English grammar and English literature as two separate subjects and same possibility for urdu so we have to cover this possibility if we have to cover these kind of edge cases.

Then in 8 9 and 10 class we have to divide students into two groups such as some students take bio as their path and others take computers this way we can allocate subjects to specific classes. This access should only be limited to admins. We might also have to add subjects (bio chem and physics) after the class 7 where science change into three subjects bio chemistry and physics. And it also depends on if he/she chooses bio or computer science.

Like these are some of the basic features that you should keep in mind while designing my system.

Admin can view attendance of classes and teachers separately. He can view the reports leaves and leave managements. Export and download reports of all these things and if necessary, manage fines.

About exams and results. Only administrators can schedule exams and exams sheets and schedule them. Oversee marks entered by teachers.

Push updates and notifications to broadcast to students or teachers or both. Publish alerts including holidays or unforeseeable circumstances.

The fee should be updated when the records are downloaded from the bank portal assigned to the school and updated and added in by the administrator. And it should automatically update the fee whether each student has submitted the fee or not. And we can only see that these students have not submitted the fee and push notifications to their apps.

Admin shall have the ability to search for students according to filters according to different search filters such as marks percentages and classes and sections and fee submitted or not grades etc.

Add proper leave management.

The dashboard is very important to us. It should not be over congested or overcomplicated. It should be simple and pleasing to the eye, and it should have a basic overview of all the necessary stuff, like attendance, timetables, pending homework, or notifications, etc. (what you think best). The same applies to teachers.