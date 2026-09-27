import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { QuizAttempt } from '@edventure/contracts';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useAction, useApi, useLocalized } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Badge, Button, Card, Row, TextField } from '@/ui/controls';
import { ErrorState, InlineError, Loading, Notice, Screen, useToast } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, radius, spacing } from '@/ui/theme';

type Question = QuizAttempt['questions'][number];
type Answer = QuizAttempt['answers'][number];

export default function AttemptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { experience } = useSession();
  const q = useApi<QuizAttempt>(['attempt', id], `/quiz-attempts/${id}`);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const staff = experience === 'teacher' || experience === 'admin';
  return (
    <>
      <Stack.Screen options={{ title: t('nav.quizzes') }} />
      {staff ? <MarkAttempt attempt={q.data} /> : q.data.state === 'in_progress' ? <TakeAttempt attempt={q.data} /> : <ReviewAttempt attempt={q.data} />}
    </>
  );
}

/** Answering: every answer is saved as it is chosen; the server enforces the deadline. */
function TakeAttempt({ attempt }: { attempt: QuizAttempt }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => Object.fromEntries(attempt.answers.map((a) => [a.questionId, a])));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  // Server clock offset so the countdown matches the server's deadline.
  const offset = useMemo(() => Date.parse(attempt.serverTime) - Date.now(), [attempt.serverTime]);
  const [now, setNow] = useState(Date.now() + offset);
  const submittedRef = useRef(false);

  const submit = useAction(() => api.post<QuizAttempt>(`/quiz-attempts/${attempt.id}/submit`), {
    invalidate: [['quizzes'], ['quiz', attempt.quizId], ['attempt', attempt.id], ['dashboard']],
    onSuccess: () => {
      toast(t('mobile.quiz.submitted'));
      router.back();
    },
  });

  useEffect(() => {
    if (!attempt.deadlineAt) return;
    const timer = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(timer);
  }, [attempt.deadlineAt, offset]);

  const remaining = attempt.deadlineAt ? Math.max(0, Date.parse(attempt.deadlineAt) - now) : null;
  useEffect(() => {
    if (remaining === 0 && !submittedRef.current) {
      submittedRef.current = true;
      submit.mutate(undefined);
    }
  }, [remaining, submit]);

  const save = async (questionId: string, patch: { selectedOptionId?: string | null; textAnswer?: string | null }) => {
    setSaving(questionId);
    setError(null);
    try {
      await api.put(`/quiz-attempts/${attempt.id}/answers`, { questionId, ...patch });
    } catch (e) {
      setError(e);
    } finally {
      setSaving(null);
    }
  };

  const answered = attempt.questions.filter((q) => answers[q.id]?.selectedOptionId || answers[q.id]?.textAnswer).length;
  const confirmSubmit = () =>
    Alert.alert(t('quiz.submit'), t('mobile.quiz.submitQuestion', { answered, total: attempt.questions.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('quiz.submit'), onPress: () => submit.mutate(undefined) },
    ]);

  return (
    <Screen
      footer={
        <View style={{ gap: spacing[2] }}>
          <InlineError error={error ?? submit.error} />
          <Button title={t('quiz.submit')} loading={submit.isPending} onPress={confirmSubmit} />
        </View>
      }
    >
      {remaining !== null && (
        <Notice tone={remaining < 120_000 ? 'danger' : 'info'} text={t('quiz.timeLeft', { minutes: Math.ceil(remaining / 60_000) })} />
      )}
      {attempt.questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          index={i}
          question={q}
          answer={answers[q.id]}
          saving={saving === q.id}
          onSelect={(optionId) => {
            setAnswers((s) => ({ ...s, [q.id]: { ...(s[q.id] ?? blankAnswer(q.id)), selectedOptionId: optionId } }));
            void save(q.id, { selectedOptionId: optionId });
          }}
          onText={(text) => setAnswers((s) => ({ ...s, [q.id]: { ...(s[q.id] ?? blankAnswer(q.id)), textAnswer: text } }))}
          onTextDone={() => void save(q.id, { textAnswer: answers[q.id]?.textAnswer ?? '' })}
        />
      ))}
    </Screen>
  );
}

const blankAnswer = (questionId: string): Answer => ({ questionId, selectedOptionId: null, textAnswer: null, score: null, feedback: null });

function QuestionCard({
  index,
  question: q,
  answer,
  saving,
  onSelect,
  onText,
  onTextDone,
  readOnly,
}: {
  index: number;
  question: Question;
  answer: Answer | undefined;
  saving?: boolean;
  onSelect?: (optionId: string) => void;
  onText?: (text: string) => void;
  onTextDone?: () => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="small" tone="muted">
          {t('mobile.quiz.questionN', { n: index + 1 })} · {t('mobile.quiz.points', { points: formatNumber(q.points) })}
        </Text>
        {saving ? <Text variant="caption" tone="muted">{t('common.saving')}</Text> : null}
      </Row>
      <Text weight="600">{localized(q.prompt, q.promptUr)}</Text>
      {q.kind === 'mcq' ? (
        <View accessibilityRole="radiogroup" style={{ gap: spacing[2] }}>
          {q.options.map((o) => {
            const on = answer?.selectedOptionId === o.id;
            const correct = o.isCorrect === true;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: readOnly }}
                onPress={readOnly ? undefined : () => onSelect?.(o.id)}
                style={[styles.option, on && styles.optionOn, readOnly && correct && styles.optionCorrect]}
              >
                <View style={[styles.radio, on && styles.radioOn]} />
                <Text style={{ flex: 1 }}>{localized(o.text, o.textUr)}</Text>
                {readOnly && correct ? <Badge tone="success" label={t('mobile.quiz.correct')} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextField label={t('mobile.quiz.yourAnswer')} value={answer?.textAnswer ?? ''} onChangeText={onText} onEndEditing={onTextDone} multiline editable={!readOnly} />
      )}
      {readOnly && (answer?.score !== null && answer?.score !== undefined) ? (
        <Text latin weight="600">{`${formatNumber(answer.score)} / ${formatNumber(q.points)}`}</Text>
      ) : null}
      {readOnly && answer?.feedback ? <Text tone="soft">{answer.feedback}</Text> : null}
    </Card>
  );
}

function ReviewAttempt({ attempt }: { attempt: QuizAttempt }) {
  const { t } = useTranslation();
  const answers = Object.fromEntries(attempt.answers.map((a) => [a.questionId, a]));
  return (
    <Screen>
      {attempt.resultsReleased ? (
        <Card>
          <Text variant="small" tone="muted">
            {t('quiz.score')}
          </Text>
          <Text variant="display" latin>{`${formatNumber(attempt.score)} / ${formatNumber(attempt.maxScore)}`}</Text>
        </Card>
      ) : (
        <Notice text={t('quiz.resultsPending')} />
      )}
      {attempt.questions.map((q, i) => (
        <QuestionCard key={q.id} index={i} question={q} answer={answers[q.id]} readOnly />
      ))}
    </Screen>
  );
}

/** Teachers mark written answers; multiple-choice answers are marked automatically. */
function MarkAttempt({ attempt }: { attempt: QuizAttempt }) {
  const { t } = useTranslation();
  const answers = Object.fromEntries(attempt.answers.map((a) => [a.questionId, a]));
  const [marks, setMarks] = useState<Record<string, { score: string; feedback: string }>>(() =>
    Object.fromEntries(attempt.questions.filter((q) => q.kind === 'short').map((q) => [q.id, { score: answers[q.id]?.score ?? '', feedback: answers[q.id]?.feedback ?? '' }])),
  );
  const mark = useAction(
    (questionId: string) => api.put(`/quiz-attempts/${attempt.id}/answers/${questionId}/mark`, { score: marks[questionId]!.score, feedback: marks[questionId]!.feedback || null }),
    { invalidate: [['attempt', attempt.id], ['quiz-attempts', attempt.quizId], ['quiz', attempt.quizId]], success: t('mobile.common.saved') },
  );
  return (
    <Screen>
      <Card>
        <Text variant="small" tone="muted">
          {t('quiz.score')}
        </Text>
        <Text variant="title" latin>{`${formatNumber(attempt.score)} / ${formatNumber(attempt.maxScore)}`}</Text>
        <Badge tone={attempt.state === 'marked' ? 'success' : 'warning'} label={t(`mobile.status.${attempt.state}`)} />
      </Card>
      {attempt.questions.map((q, i) => (
        <View key={q.id} style={{ gap: spacing[2] }}>
          <QuestionCard index={i} question={q} answer={answers[q.id]} readOnly />
          {q.kind === 'short' && marks[q.id] && (
            <Card>
              {q.guidance ? <Notice text={q.guidance} /> : null}
              <TextField
                label={t('mobile.quiz.scoreOutOf', { max: formatNumber(q.points) })}
                value={marks[q.id]!.score}
                keyboardType="decimal-pad"
                onChangeText={(v) => setMarks((s) => ({ ...s, [q.id]: { ...s[q.id]!, score: v.trim() } }))}
              />
              <TextField label={t('homework.feedback')} value={marks[q.id]!.feedback} multiline onChangeText={(v) => setMarks((s) => ({ ...s, [q.id]: { ...s[q.id]!, feedback: v } }))} />
              <Button small title={t('common.save')} loading={mark.isPending && mark.variables === q.id} disabled={!marks[q.id]!.score || Number(marks[q.id]!.score) > Number(q.points)} onPress={() => mark.mutate(q.id)} />
            </Card>
          )}
        </View>
      ))}
      <InlineError error={mark.error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 48, paddingHorizontal: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  optionOn: { borderColor: colors.accent[600], backgroundColor: colors.accent[50] },
  optionCorrect: { borderColor: colors.success.fg },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.lineStrong },
  radioOn: { borderColor: colors.accent[600], backgroundColor: colors.accent[600] },
});
