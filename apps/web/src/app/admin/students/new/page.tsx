'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { IssuedCredential, StudentDetail } from '@edventure/contracts';
import { CredentialDialog } from '@/components/people/account-actions';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { Card, PageHeader } from '@/components/ui/layout';
import { InlineError } from '@/components/ui/states';
import { api, fieldError } from '@/lib/api';
import { todayLocal } from '@/lib/format';
import { useAction, useActiveYear, useClasses, useStreams } from '@/lib/hooks';

export default function NewStudentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { year } = useActiveYear();
  const classes = useClasses(year?.id);
  const streams = useStreams();
  const [f, setF] = useState({
    displayName: '',
    displayNameUr: '',
    admissionNumber: '',
    username: '',
    admissionDate: todayLocal(),
    gender: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    address: '',
    classOfferingId: '',
    sectionId: '',
    streamId: '',
    guardianName: '',
    guardianRelationship: 'Father',
    guardianPhone: '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const [created, setCreated] = useState<{ id: string; credential: IssuedCredential | null } | null>(null);
  const cls = classes.data?.items.find((c) => c.id === f.classOfferingId);
  const streamOptions = useMemo(() => {
    const ids = new Set((cls?.courses ?? []).map((c) => c.streamId).filter(Boolean));
    return (streams.data?.items ?? []).filter((s) => ids.has(s.id)).map((s) => ({ value: s.id, label: s.name }));
  }, [cls, streams.data]);

  const create = useAction(
    () =>
      api.post<{ student: StudentDetail; credential: IssuedCredential | null; provisioningError: string | null }>('/students', {
        displayName: f.displayName,
        displayNameUr: f.displayNameUr || null,
        admissionNumber: f.admissionNumber,
        username: f.username,
        admissionDate: f.admissionDate,
        gender: f.gender || null,
        dateOfBirth: f.dateOfBirth || null,
        phone: f.phone || null,
        email: f.email || null,
        address: f.address || null,
        enrollment: { classOfferingId: f.classOfferingId, sectionId: f.sectionId, streamId: f.streamId || null },
        guardians: f.guardianName ? [{ name: f.guardianName, relationship: f.guardianRelationship, phone: f.guardianPhone || null, isPrimary: true }] : [],
      }),
    { invalidate: [['students']], onSuccess: (r) => setCreated({ id: r.student.id, credential: r.credential }) },
  );
  const err = create.error;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(undefined);
  };

  return (
    <>
      <PageHeader title={t('web.people.addStudent')} subtitle={year?.name} />
      <form onSubmit={submit} className="flex max-w-4xl flex-col gap-5">
        <Card title={t('web.people.personal')}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label={t('web.common.name')} value={f.displayName} onValue={set('displayName')} required error={fieldError(err, 'displayName')} />
            <TextField label={t('web.common.nameUr')} value={f.displayNameUr} onValue={set('displayNameUr')} dir="rtl" />
            <TextField label={t('web.people.admissionNumber')} value={f.admissionNumber} onValue={set('admissionNumber')} dir="ltr" required error={fieldError(err, 'admissionNumber')} />
            <TextField label={t('auth.username')} value={f.username} onValue={set('username')} dir="ltr" required hint={t('web.people.usernameHint')} error={fieldError(err, 'username')} />
            <TextField label={t('web.people.admissionDate')} type="date" value={f.admissionDate} onValue={set('admissionDate')} required error={fieldError(err, 'admissionDate')} />
            <SelectField
              label={t('web.common.gender')}
              value={f.gender}
              onValue={set('gender')}
              placeholder={t('common.optional')}
              options={[
                { value: 'female', label: t('web.common.female') },
                { value: 'male', label: t('web.common.male') },
                { value: 'other', label: t('web.common.other') },
              ]}
            />
            <TextField label={t('web.common.dateOfBirth')} type="date" value={f.dateOfBirth} onValue={set('dateOfBirth')} />
            <TextField label={t('web.common.phone')} value={f.phone} onValue={set('phone')} dir="ltr" error={fieldError(err, 'phone')} />
            <TextField label={t('web.common.email')} value={f.email} onValue={set('email')} dir="ltr" error={fieldError(err, 'email')} />
            <TextField label={t('web.common.address')} value={f.address} onValue={set('address')} />
          </div>
        </Card>
        <Card title={t('web.people.placement')}>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField
              label={t('web.common.class')}
              value={f.classOfferingId}
              onValue={(v) => setF((s) => ({ ...s, classOfferingId: v, sectionId: '', streamId: '' }))}
              placeholder={t('web.common.select')}
              required
              options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }))}
            />
            <SelectField
              label={t('web.common.section')}
              value={f.sectionId}
              onValue={set('sectionId')}
              placeholder={t('web.common.select')}
              required
              disabled={!cls}
              options={(cls?.sections ?? []).filter((s) => !s.archived).map((s) => ({ value: s.id, label: `${s.name} (${s.studentCount}${s.capacity ? `/${s.capacity}` : ''})` }))}
            />
            {streamOptions.length > 0 && (
              <SelectField label={t('web.common.stream')} value={f.streamId} onValue={set('streamId')} placeholder={t('web.common.none')} options={streamOptions} />
            )}
          </div>
        </Card>
        <Card title={t('web.people.guardian')}>
          <div className="grid gap-4 md:grid-cols-3">
            <TextField label={t('web.common.name')} value={f.guardianName} onValue={set('guardianName')} />
            <TextField label={t('web.people.relationship')} value={f.guardianRelationship} onValue={set('guardianRelationship')} />
            <TextField label={t('web.common.phone')} value={f.guardianPhone} onValue={set('guardianPhone')} dir="ltr" />
          </div>
        </Card>
        <InlineError error={err} />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={create.isPending}>
            {t('web.people.createStudent')}
          </Button>
          <Button onClick={() => router.back()}>{t('common.cancel')}</Button>
        </div>
      </form>
      <CredentialDialog
        credentials={created?.credential ? [created.credential] : null}
        onClose={() => router.replace(`/admin/students/${created!.id}`)}
      />
      {created && !created.credential && (
        <p className="mt-4 rounded-lg bg-warning-bg px-3 py-2 text-warning-fg">{t('web.people.provisioningPending')}</p>
      )}
    </>
  );
}
