'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { IssuedCredential, TeacherDetail } from '@edventure/contracts';
import { CredentialDialog } from '@/components/people/account-actions';
import { Button } from '@/components/ui/button';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Card, PageHeader } from '@/components/ui/layout';
import { InlineError } from '@/components/ui/states';
import { api, fieldError } from '@/lib/api';
import { todayLocal } from '@/lib/format';
import { useAction } from '@/lib/hooks';

export default function NewTeacherPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [f, setF] = useState({ displayName: '', displayNameUr: '', employeeNumber: '', username: '', employmentStartDate: todayLocal(), jobTitle: '', gender: '', phone: '', email: '', qualifications: '', isAdmin: false });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const [created, setCreated] = useState<{ id: string; credential: IssuedCredential | null } | null>(null);
  const create = useAction(
    () =>
      api.post<{ teacher: TeacherDetail; credential: IssuedCredential | null }>('/teachers', {
        ...f,
        displayNameUr: f.displayNameUr || null,
        jobTitle: f.jobTitle || null,
        gender: f.gender || null,
        phone: f.phone || null,
        email: f.email || null,
        qualifications: f.qualifications || null,
      }),
    { invalidate: [['teachers']], onSuccess: (r) => setCreated({ id: r.teacher.id, credential: r.credential }) },
  );
  const err = create.error;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(undefined);
  };
  return (
    <>
      <PageHeader title={t('web.people.addTeacher')} />
      <form onSubmit={submit} className="flex max-w-4xl flex-col gap-5">
        <Card title={t('web.people.personal')}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label={t('web.common.name')} value={f.displayName} onValue={set('displayName')} required error={fieldError(err, 'displayName')} />
            <TextField label={t('web.common.nameUr')} value={f.displayNameUr} onValue={set('displayNameUr')} dir="rtl" />
            <TextField label={t('web.people.employeeNumber')} value={f.employeeNumber} onValue={set('employeeNumber')} dir="ltr" required error={fieldError(err, 'employeeNumber')} />
            <TextField label={t('auth.username')} value={f.username} onValue={set('username')} dir="ltr" required hint={t('web.people.usernameHint')} error={fieldError(err, 'username')} />
            <TextField label={t('web.people.employmentStart')} type="date" value={f.employmentStartDate} onValue={set('employmentStartDate')} required />
            <TextField label={t('web.people.jobTitle')} value={f.jobTitle} onValue={set('jobTitle')} />
            <SelectField label={t('web.common.gender')} value={f.gender} onValue={set('gender')} placeholder={t('common.optional')} options={['female', 'male', 'other'].map((g) => ({ value: g, label: t(`web.common.${g}`) }))} />
            <TextField label={t('web.common.phone')} value={f.phone} onValue={set('phone')} dir="ltr" error={fieldError(err, 'phone')} />
            <TextField label={t('web.common.email')} value={f.email} onValue={set('email')} dir="ltr" error={fieldError(err, 'email')} />
            <TextField label={t('web.people.qualifications')} value={f.qualifications} onValue={set('qualifications')} />
          </div>
          <div className="mt-4">
            <Checkbox label={t('web.people.alsoAdmin')} hint={t('web.people.alsoAdminHint')} checked={f.isAdmin} onChange={(v) => setF((s) => ({ ...s, isAdmin: v }))} />
          </div>
        </Card>
        <InlineError error={err} />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={create.isPending}>{t('web.people.createTeacher')}</Button>
          <Button onClick={() => router.back()}>{t('common.cancel')}</Button>
        </div>
      </form>
      <CredentialDialog credentials={created?.credential ? [created.credential] : null} onClose={() => router.replace(`/admin/teachers/${created!.id}`)} />
    </>
  );
}
