'use client';

import { Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HomeworkSummary, Page, QuizSummary, z } from '@edventure/contracts';
import { homeworkDetail, homeworkStates, learningMaterial, quizAttemptRow, quizStates, recipientStatus } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/field';
import { Badge, Card, DefinitionList, PageHeader, Tabs, Toolbar } from '@/components/ui/layout';
import { EmptyState, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api, downloadFile } from '@/lib/api';
import { formatDate, formatDateTime, stateTone } from '@/lib/format';
import { useAction, useActiveYear, useApi, useLang, useSectionOptions } from '@/lib/hooks';

type Tab = 'homework' | 'quizzes' | 'materials';

export default function LearningPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('homework');
  return (
    <>
      <PageHeader title={t('nav.learning')} subtitle={t('web.learning.subtitle')} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'homework', label: t('nav.homework') },
          { value: 'quizzes', label: t('nav.quizzes') },
          { value: 'materials', label: t('nav.materials') },
        ]}
      />
      {tab === 'homework' && <Homework />}
      {tab === 'quizzes' && <Quizzes />}
      {tab === 'materials' && <Materials />}
    </>
  );
}

function Homework() {
  const { t } = useTranslation();
  const lang = useLang();
  const { year } = useActiveYear();
  const sections = useSectionOptions(year?.id);
  const [sectionId, setSectionId] = useState('');
  const [state, setState] = useState('published');
  const [limit, setLimit] = useState(50);
  const q = useApi<Page<HomeworkSummary>>(['homework', sectionId, state, limit], '/homework', { sectionId: sectionId || undefined, state: state || undefined, limit });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SelectField className="w-52" label={t('web.common.section')} value={sectionId} onValue={setSectionId} placeholder={t('common.all')} options={sections.options} />
        <SelectField className="w-44" label={t('common.status')} value={state} onValue={setState} placeholder={t('common.all')} options={homeworkStates.map((s) => ({ value: s, label: t(`web.status.${s}`) }))} />
      </Toolbar>
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpen(r.id)}
            empty={<EmptyState title={t('web.learning.noHomework')} />}
            footer={q.data?.nextCursor ? <Button size="sm" onClick={() => setLimit((l) => Math.min(100, l + 50))}>{t('common.loadMore')}</Button> : undefined}
            columns={[
              { key: 't', header: t('web.common.title'), cell: (r) => <div><p className="font-medium">{lang === 'ur' && r.titleUr ? r.titleUr : r.title}</p><p className="text-[12px] text-muted">{r.subjectName} · {r.groupName}</p></div> },
              { key: 'd', header: t('fees.dueDate'), cell: (r) => formatDate(r.dueDate, lang) },
              { key: 'b', header: t('web.learning.setBy'), cell: (r) => r.createdBy },
              { key: 'c', header: t('web.learning.completion'), numeric: true, cell: (r) => (r.completion ? `${r.completion.submitted + r.completion.completed}/${r.completion.total}` : '—') },
              { key: 's', header: t('common.status'), cell: (r) => <Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`web.status.${r.state}`)}</Badge> },
            ]}
          />
        )}
      </Card>
      {open && <HomeworkDialog id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function HomeworkDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<z.infer<typeof homeworkDetail>>(['homework', id], `/homework/${id}`);
  const recipients = useApi<{ items: z.infer<typeof recipientStatus>[] }>(['homework-recipients', id], `/homework/${id}/recipients`);
  const archive = useAction(() => api.post(`/homework/${id}/archive`), { invalidate: [['homework']], success: t('web.common.updated'), onSuccess: onClose });
  const h = q.data;
  return (
    <Dialog open onClose={onClose} title={h ? (lang === 'ur' && h.titleUr ? h.titleUr : h.title) : t('common.loading')} wide footer={h && h.state !== 'archived' ? <Button loading={archive.isPending} onClick={() => archive.mutate(undefined)}>{t('web.common.archive')}</Button> : undefined}>
      {!h ? (
        <LoadingBlock />
      ) : (
        <div className="flex flex-col gap-4">
          <DefinitionList
            items={[
              [t('web.common.subject'), `${h.subjectName} · ${h.groupName}`],
              [t('fees.dueDate'), `${formatDate(h.dueDate, lang)}${h.dueTime ? ` ${h.dueTime}` : ''}`],
              [t('web.learning.submission'), t(`web.learning.policy.${h.submissionPolicy}`)],
              [t('web.learning.setBy'), h.createdBy],
            ]}
          />
          {h.instructions && <p className="whitespace-pre-wrap rounded-lg bg-sunken px-4 py-3 text-sm">{lang === 'ur' && h.instructionsUr ? h.instructionsUr : h.instructions}</p>}
          {h.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {h.attachments.map((a) => (
                <Button key={a.id} size="sm" icon={<Paperclip size={14} />} onClick={() => downloadFile(a.id)}>{a.name}</Button>
              ))}
            </div>
          )}
          <DataTable
            rows={recipients.data?.items ?? []}
            rowKey={(r) => r.recipientId}
            columns={[
              { key: 'n', header: t('web.common.student'), cell: (r) => <div><p className="font-medium">{r.displayName}</p><p className="text-[12px] text-muted">{r.admissionNumber}</p></div> },
              { key: 's', header: t('common.status'), cell: (r) => <Badge tone={r.completionState === 'pending' ? 'warning' : r.completionState === 'excused' ? 'neutral' : 'success'}>{t(`homework.${r.completionState === 'excused' ? 'completed' : r.completionState}`)}</Badge> },
              { key: 'l', header: t('web.learning.lastSubmission'), cell: (r) => (r.latestSubmission ? <span>{formatDateTime(r.latestSubmission.submittedAt, lang)}{r.latestSubmission.isLate && <Badge tone="warning"> {t('homework.late')}</Badge>}</span> : '—') },
              { key: 'f', header: t('homework.feedback'), cell: (r) => <span className="line-clamp-1 text-[13px]">{r.latestSubmission?.feedback ?? '—'}</span> },
            ]}
          />
        </div>
      )}
    </Dialog>
  );
}

function Quizzes() {
  const { t } = useTranslation();
  const lang = useLang();
  const [state, setState] = useState('');
  const q = useApi<Page<QuizSummary>>(['quizzes', state], '/quizzes', { state: state || undefined, limit: 100 });
  const [open, setOpen] = useState<QuizSummary | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SelectField className="w-44" label={t('common.status')} value={state} onValue={setState} placeholder={t('common.all')} options={quizStates.map((s) => ({ value: s, label: t(`web.status.${s}`) }))} />
      </Toolbar>
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={setOpen}
            empty={<EmptyState title={t('web.learning.noQuizzes')} />}
            columns={[
              { key: 't', header: t('web.common.title'), cell: (r) => <div><p className="font-medium">{lang === 'ur' && r.titleUr ? r.titleUr : r.title}</p><p className="text-[12px] text-muted">{r.subjectName} · {r.groupName}</p></div> },
              { key: 'w', header: t('web.learning.window'), cell: (r) => (r.availableUntil ? `${t('common.to')} ${formatDateTime(r.availableUntil, lang)}` : '—') },
              { key: 'q', header: t('web.learning.questions'), numeric: true, cell: (r) => r.questionCount },
              { key: 'a', header: t('web.learning.attempts'), numeric: true, cell: (r) => r.attemptsSubmitted ?? 0 },
              { key: 'm', header: t('web.learning.toMark'), numeric: true, cell: (r) => (r.toMark ? <Badge tone="warning">{r.toMark}</Badge> : 0) },
              { key: 's', header: t('common.status'), cell: (r) => <div className="flex gap-1"><Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`web.status.${r.state}`)}</Badge>{r.resultsReleased && <Badge tone="info">{t('web.learning.released')}</Badge>}</div> },
            ]}
          />
        )}
      </Card>
      {open && <QuizDialog quiz={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function QuizDialog({ quiz, onClose }: { quiz: QuizSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const attempts = useApi<{ items: z.infer<typeof quizAttemptRow>[] }>(['quiz-attempts', quiz.id], `/quizzes/${quiz.id}/attempts`);
  const close = useAction(() => api.post(`/quizzes/${quiz.id}/close`), { invalidate: [['quizzes']], success: t('web.common.updated'), onSuccess: onClose });
  const release = useAction(() => api.post(`/quizzes/${quiz.id}/release-results`), { invalidate: [['quizzes']], success: t('web.learning.releasedToast'), onSuccess: onClose, toastErrors: true });
  return (
    <Dialog
      open
      onClose={onClose}
      title={quiz.title}
      wide
      footer={
        <>
          {quiz.state === 'published' && <Button loading={close.isPending} onClick={() => close.mutate(undefined)}>{t('web.learning.closeQuiz')}</Button>}
          {!quiz.resultsReleased && quiz.state !== 'draft' && <Button variant="primary" loading={release.isPending} disabled={(quiz.toMark ?? 0) > 0} onClick={() => release.mutate(undefined)}>{t('web.learning.releaseResults')}</Button>}
        </>
      }
    >
      {(quiz.toMark ?? 0) > 0 && <p className="mb-3 rounded-lg bg-warning-bg px-3 py-2 text-[13px] text-warning-fg">{t('web.learning.markFirst', { count: quiz.toMark })}</p>}
      {attempts.isLoading ? (
        <LoadingBlock />
      ) : (
        <DataTable
          rows={attempts.data?.items ?? []}
          rowKey={(r) => r.id}
          empty={<EmptyState title={t('web.learning.noAttempts')} />}
          columns={[
            { key: 'n', header: t('web.common.student'), cell: (r) => r.displayName },
            { key: 'a', header: '#', numeric: true, cell: (r) => r.attemptNumber },
            { key: 'd', header: t('web.learning.submitted'), cell: (r) => formatDateTime(r.submittedAt, lang) },
            { key: 's', header: t('quiz.score'), numeric: true, cell: (r) => (r.score !== null ? `${r.score}/${r.maxScore}` : '—') },
            { key: 'm', header: '', cell: (r) => (r.needsMarking ? <Badge tone="warning">{t('web.learning.needsMarking')}</Badge> : null) },
          ]}
        />
      )}
      <p className="mt-3 text-[13px] text-muted">{t('web.learning.markingHint')}</p>
    </Dialog>
  );
}

function Materials() {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<{ items: z.infer<typeof learningMaterial>[] }>(['materials'], '/materials');
  const archive = useAction((id: string) => api.post(`/materials/${id}/archive`), { invalidate: [['materials']], toastErrors: true });
  return (
    <Card padded={false}>
      {q.isLoading ? (
        <LoadingBlock />
      ) : (
        <DataTable
          rows={q.data?.items ?? []}
          rowKey={(r) => r.id}
          empty={<EmptyState title={t('web.learning.noMaterials')} />}
          columns={[
            { key: 't', header: t('web.common.title'), cell: (r) => <div><p className="font-medium">{lang === 'ur' && r.titleUr ? r.titleUr : r.title}</p><p className="text-[12px] text-muted">{r.subjectName} · {r.groupName}</p></div> },
            { key: 'b', header: t('web.learning.setBy'), cell: (r) => r.createdBy },
            { key: 'd', header: t('common.published'), cell: (r) => formatDateTime(r.publishedAt, lang) },
            {
              key: 'a',
              header: '',
              cell: (r) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" icon={<Paperclip size={14} />} onClick={() => downloadFile(r.file.id)}>{t('common.download')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => archive.mutate(r.id)}>{t('web.common.archive')}</Button>
                </div>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}
