import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { QuizAttempt, QuizSummary, z } from '@edventure/contracts';
import type { quizAttemptRow, quizDetail } from '@edventure/contracts';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber, stateTone } from '@/lib/format';
import { useAction, useApi, useLang, useLocalized } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Badge, Button, Card, Divider, ListRow, Row } from '@/ui/controls';
import { EmptyState, ErrorState, InlineError, Loading, Notice, Screen, SectionTitle } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

type Quiz = z.infer<typeof quizDetail>;

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const { experience } = useSession();
  const q = useApi<Quiz>(['quiz', id], `/quizzes/${id}`);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const quiz = q.data;
  const staff = experience === 'teacher' || experience === 'admin';
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: t('nav.quizzes') }} />
      <Card>
        <Text variant="title">{localized(quiz.title, quiz.titleUr)}</Text>
        <Text tone="muted">
          {quiz.subjectName} · {quiz.groupName}
        </Text>
        <Row style={{ flexWrap: 'wrap' }}>
          <Badge tone={stateTone[quiz.state] ?? 'neutral'} label={t(`mobile.status.${quiz.state}`)} />
          <Badge tone="info" label={t('mobile.quiz.questions', { count: quiz.questionCount, points: formatNumber(quiz.totalPoints) })} />
          {quiz.timeLimitMinutes ? <Badge label={t('mobile.quiz.timeLimit', { minutes: quiz.timeLimitMinutes })} /> : null}
        </Row>
        {quiz.instructions ? <Text>{quiz.instructions}</Text> : null}
        {quiz.availableUntil ? (
          <Text variant="small" tone="muted">
            {t('mobile.quiz.openUntil', { time: formatDateTime(quiz.availableUntil, lang) })}
          </Text>
        ) : null}
      </Card>
      {staff ? <StaffQuiz quiz={quiz} /> : <StudentQuiz quiz={quiz} />}
    </Screen>
  );
}

function StudentQuiz({ quiz }: { quiz: QuizSummary }) {
  const { t } = useTranslation();
  const router = useRouter();
  const start = useAction(() => api.post<QuizAttempt>(`/quizzes/${quiz.id}/attempts`), {
    invalidate: [['quizzes'], ['quiz', quiz.id]],
    onSuccess: (a) => router.push(`/attempt/${a.id}`),
  });
  const a = quiz.myAttempt;
  return (
    <Card>
      {a && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Badge tone={stateTone[a.state] ?? 'neutral'} label={t(`mobile.status.${a.state}`)} />
          {a.score !== null && quiz.resultsReleased ? <Text weight="600" latin>{`${formatNumber(a.score)} / ${formatNumber(quiz.totalPoints)}`}</Text> : null}
        </Row>
      )}
      {a?.state === 'in_progress' ? (
        <Button title={t('quiz.resume')} icon="play-outline" onPress={() => router.push(`/attempt/${a.id}`)} />
      ) : a && !quiz.resultsReleased ? (
        <Notice text={t('quiz.resultsPending')} />
      ) : a ? (
        <Button variant="secondary" title={t('mobile.quiz.viewResult')} onPress={() => router.push(`/attempt/${a.id}`)} />
      ) : null}
      {quiz.state === 'published' && a?.state !== 'in_progress' && (quiz.attemptsRemaining ?? 0) > 0 && (
        <>
          <Text variant="small" tone="muted">
            {t('mobile.quiz.attemptsLeft', { count: quiz.attemptsRemaining ?? 0 })} · {t('quiz.needsConnection')}
          </Text>
          <Button title={a ? t('mobile.quiz.tryAgain') : t('quiz.start')} icon="play-outline" loading={start.isPending} onPress={() => start.mutate(undefined)} />
        </>
      )}
      {quiz.state === 'closed' && !a && <Notice tone="warning" text={t('mobile.quiz.closed')} />}
      <InlineError error={start.error} />
    </Card>
  );
}

function StaffQuiz({ quiz }: { quiz: Quiz }) {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const attempts = useApi<{ items: z.infer<typeof quizAttemptRow>[] }>(['quiz-attempts', quiz.id], `/quizzes/${quiz.id}/attempts`);
  const invalidate = [['quiz', quiz.id], ['quizzes'], ['quiz-attempts', quiz.id]];
  const publish = useAction(() => api.post(`/quizzes/${quiz.id}/publish`), { invalidate, success: t('mobile.quiz.publishedToast'), toastErrors: true });
  const close = useAction(() => api.post(`/quizzes/${quiz.id}/close`), { invalidate, success: t('mobile.common.saved'), toastErrors: true });
  const release = useAction(() => api.post(`/quizzes/${quiz.id}/release-results`), { invalidate, success: t('mobile.quiz.releasedToast'), toastErrors: true });
  const items = attempts.data?.items ?? [];
  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        {quiz.state === 'draft' && <Button title={t('common.publish')} icon="send-outline" loading={publish.isPending} onPress={() => publish.mutate(undefined)} />}
        {quiz.state === 'published' && <Button variant="secondary" title={t('mobile.quiz.close')} loading={close.isPending} onPress={() => close.mutate(undefined)} />}
        {quiz.state !== 'draft' && !quiz.resultsReleased && (
          <Button variant="secondary" title={t('mobile.quiz.release')} disabled={(quiz.toMark ?? 0) > 0} loading={release.isPending} onPress={() => release.mutate(undefined)} />
        )}
      </Row>
      {(quiz.toMark ?? 0) > 0 && <Notice tone="warning" text={t('mobile.quiz.toMark', { count: quiz.toMark })} />}
      <SectionTitle>{t('mobile.quiz.attempts')}</SectionTitle>
      {attempts.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title={t('mobile.quiz.noAttempts')} />
      ) : (
        <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
          {items.map((a, i) => (
            <View key={a.id}>
              {i > 0 && <Divider />}
              <ListRow
                title={a.displayName}
                subtitle={a.submittedAt ? formatDateTime(a.submittedAt, lang) : t(`mobile.status.${a.state}`)}
                trailing={a.needsMarking ? <Badge tone="warning" label={t('mobile.quiz.needsMarking')} /> : a.score !== null ? <Text latin weight="600">{`${formatNumber(a.score)}/${formatNumber(a.maxScore)}`}</Text> : undefined}
                onPress={a.state === 'in_progress' ? undefined : () => router.push(`/attempt/${a.id}`)}
              />
            </View>
          ))}
        </Card>
      )}
    </>
  );
}
