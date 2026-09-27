import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { AcademicYear, ExamCycle, ExamPaper, HomeworkSummary, Page, QuizSummary, TeachingGroup } from '@edventure/contracts';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, stateTone } from '@/lib/format';
import { useApi, useLang, useLocalized } from '@/lib/queries';
import { Badge, Button, Card, Divider, ListRow, Segmented } from '@/ui/controls';
import { EmptyState, ErrorState, Loading, Screen, SectionTitle } from '@/ui/screen';
import { spacing } from '@/ui/theme';

type Tab = 'homework' | 'quizzes' | 'marks';

export default function TeacherWork() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('homework');
  return (
    <Screen>
      <Segmented<Tab>
        accessibilityLabel={t('nav.work')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'homework', label: t('nav.homework') },
          { value: 'quizzes', label: t('nav.quizzes') },
          { value: 'marks', label: t('exams.marks') },
        ]}
      />
      {tab === 'homework' && <HomeworkTab />}
      {tab === 'quizzes' && <QuizTab />}
      {tab === 'marks' && <MarksTab />}
    </Screen>
  );
}

function HomeworkTab() {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const q = useApi<Page<HomeworkSummary>>(['homework', 'teacher'], '/homework', { limit: 50 });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data?.items ?? [];
  return (
    <>
      <Button icon="add" title={t('mobile.work.newHomework')} onPress={() => router.push('/homework/new')} />
      {items.length === 0 ? (
        <EmptyState icon="document-text-outline" title={t('mobile.homework.none')} />
      ) : (
        <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
          {items.map((h, i) => (
            <View key={h.id}>
              {i > 0 && <Divider />}
              <ListRow
                title={localized(h.title, h.titleUr)}
                subtitle={`${h.groupName} · ${t('homework.due', { date: formatDate(h.dueDate, lang) })}${h.completion ? ` · ${t('homework.completion', { done: h.completion.submitted + h.completion.completed, total: h.completion.total })}` : ''}`}
                trailing={<Badge tone={stateTone[h.state] ?? 'neutral'} label={t(`mobile.status.${h.state}`)} />}
                onPress={() => router.push(`/homework/${h.id}`)}
              />
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function QuizTab() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const router = useRouter();
  const q = useApi<Page<QuizSummary>>(['quizzes', 'teacher'], '/quizzes', { limit: 50 });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data?.items ?? [];
  return (
    <>
      <Button icon="add" title={t('mobile.work.newQuiz')} onPress={() => router.push('/quiz/new')} />
      {items.length === 0 ? (
        <EmptyState icon="help-circle-outline" title={t('mobile.quiz.none')} />
      ) : (
        <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
          {items.map((qz, i) => (
            <View key={qz.id}>
              {i > 0 && <Divider />}
              <ListRow
                title={localized(qz.title, qz.titleUr)}
                subtitle={`${qz.groupName} · ${t('mobile.quiz.submittedCount', { count: qz.attemptsSubmitted ?? 0 })}`}
                trailing={(qz.toMark ?? 0) > 0 ? <Badge tone="warning" label={t('mobile.quiz.toMarkShort', { count: qz.toMark })} /> : <Badge tone={stateTone[qz.state] ?? 'neutral'} label={t(`mobile.status.${qz.state}`)} />}
                onPress={() => router.push(`/quiz/${qz.id}`)}
              />
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

/** Exam papers open for marking that belong to subjects this teacher teaches. */
function MarksTab() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const router = useRouter();
  const years = useApi<{ items: AcademicYear[] }>(['academic-years'], '/academic-years');
  const year = years.data?.items.find((y) => y.status === 'active');
  const groups = useApi<{ items: TeachingGroup[] }>(['teaching-groups', 'mine'], '/teaching-groups', { mine: 'true' });
  const cycles = useApi<{ items: ExamCycle[] }>(['exams', year?.id], year ? '/exams' : null, year ? { academicYearId: year.id } : undefined);
  const open = (cycles.data?.items ?? []).filter((c) => c.state === 'scheduled' || c.state === 'marking');
  const papers = useQueries({ queries: open.map((c) => ({ queryKey: ['exam-papers', c.id], queryFn: () => api.get<{ items: ExamPaper[] }>(`/exams/${c.id}/papers`) })) });
  const mine = useMemo(() => new Set((groups.data?.items ?? []).map((g) => g.courseOfferingId)), [groups.data]);

  if (years.isLoading || groups.isLoading || cycles.isLoading || papers.some((p) => p.isLoading)) return <Loading />;
  if (open.length === 0) return <EmptyState icon="school-outline" title={t('mobile.marks.none')} />;
  return (
    <>
      {open.map((c, i) => {
        const list = (papers[i]?.data?.items ?? []).filter((p) => mine.has(p.courseOfferingId));
        return (
          <View key={c.id} style={{ gap: spacing[2] }}>
            <SectionTitle>{localized(c.name, c.nameUr)}</SectionTitle>
            {c.state === 'scheduled' && <Badge tone="info" label={t('mobile.marks.notOpenYet')} />}
            <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
              {list.length === 0 ? (
                <EmptyState title={t('mobile.marks.noPapers')} />
              ) : (
                list.map((p, j) => (
                  <View key={p.id}>
                    {j > 0 && <Divider />}
                    <ListRow
                      title={`${localized(p.subjectName, p.subjectNameUr)} · ${p.gradeName}`}
                      subtitle={t('mobile.marks.progress', { done: p.markedCount, total: p.registrationCount })}
                      trailing={p.locked ? <Badge tone="warning" label={t('mobile.marks.locked')} /> : undefined}
                      onPress={() => router.push(`/marks/${p.id}`)}
                    />
                  </View>
                ))
              )}
            </Card>
          </View>
        );
      })}
    </>
  );
}
