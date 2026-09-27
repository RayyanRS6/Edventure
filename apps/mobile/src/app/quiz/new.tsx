import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import type { QuizSummary, TeachingGroup } from '@edventure/contracts';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/queries';
import { Button, Card, ChoiceField, Row, Segmented, TextField } from '@/ui/controls';
import { InlineError, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, spacing } from '@/ui/theme';

type Question = { kind: 'mcq' | 'short'; prompt: string; points: string; guidance: string; options: Array<{ text: string; isCorrect: boolean }> };
const blankQuestion = (): Question => ({ kind: 'mcq', prompt: '', points: '1', guidance: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] });

/** Quiz builder: multiple-choice (auto-marked) and short-answer (teacher-marked) questions. Saved as a draft. */
export default function NewQuiz() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const groups = useApi<{ items: TeachingGroup[] }>(['teaching-groups', 'mine'], '/teaching-groups', { mine: 'true' });
  const [f, setF] = useState({ teachingGroupId: groupId ?? '', title: '', instructions: '', timeLimitMinutes: '', maxAttempts: '1' });
  const [questions, setQuestions] = useState<Question[]>([blankQuestion()]);
  const setQ = (i: number, patch: Partial<Question>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const create = useAction(
    () =>
      api.post<QuizSummary>('/quizzes', {
        teachingGroupId: f.teachingGroupId,
        title: f.title,
        instructions: f.instructions || null,
        timeLimitMinutes: f.timeLimitMinutes ? Number(f.timeLimitMinutes) : null,
        maxAttempts: Number(f.maxAttempts) || 1,
        questions: questions.map((q) => ({
          kind: q.kind,
          prompt: q.prompt,
          points: q.points,
          guidance: q.kind === 'short' ? q.guidance || null : null,
          options: q.kind === 'mcq' ? q.options.filter((o) => o.text.trim()) : [],
        })),
      }),
    { invalidate: [['quizzes']], success: t('mobile.quiz.draftSaved'), onSuccess: (qz) => router.replace(`/quiz/${qz.id}`) },
  );
  const valid =
    f.teachingGroupId &&
    f.title.trim() &&
    questions.every((q) => q.prompt.trim() && Number(q.points) > 0 && (q.kind === 'short' || (q.options.filter((o) => o.text.trim()).length >= 2 && q.options.filter((o) => o.text.trim() && o.isCorrect).length === 1)));

  return (
    <Screen footer={<Button title={t('mobile.quiz.saveDraft')} loading={create.isPending} disabled={!valid} onPress={() => create.mutate(undefined)} />}>
      <Stack.Screen options={{ title: t('mobile.work.newQuiz') }} />
      <Card>
        <ChoiceField label={t('mobile.work.group')} value={f.teachingGroupId} onChange={(v) => setF({ ...f, teachingGroupId: v })} placeholder={t('mobile.common.choose')} options={(groups.data?.items ?? []).map((g) => ({ value: g.id, label: `${g.name} · ${g.subjectName}` }))} />
        <TextField label={t('mobile.work.title')} value={f.title} onChangeText={(v) => setF({ ...f, title: v })} />
        <TextField label={t('mobile.work.instructions')} value={f.instructions} onChangeText={(v) => setF({ ...f, instructions: v })} multiline />
        <Row>
          <View style={{ flex: 1 }}>
            <TextField label={t('mobile.quiz.timeLimitLabel')} value={f.timeLimitMinutes} onChangeText={(v) => setF({ ...f, timeLimitMinutes: v.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" hint={t('mobile.common.optional')} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label={t('mobile.quiz.attemptsLabel')} value={f.maxAttempts} onChangeText={(v) => setF({ ...f, maxAttempts: v.replace(/\D/g, '').slice(0, 1) })} keyboardType="number-pad" hint="1–5" />
          </View>
        </Row>
      </Card>

      {questions.map((q, i) => (
        <Card
          key={i}
          title={t('mobile.quiz.questionN', { n: i + 1 })}
          action={
            questions.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} onPress={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color={colors.danger.fg} />
              </Pressable>
            ) : undefined
          }
        >
          <Segmented
            accessibilityLabel={t('mobile.quiz.kind')}
            value={q.kind}
            onChange={(kind) => setQ(i, { kind })}
            options={[
              { value: 'mcq', label: t('mobile.quiz.mcq') },
              { value: 'short', label: t('mobile.quiz.short') },
            ]}
          />
          <TextField label={t('mobile.quiz.prompt')} value={q.prompt} onChangeText={(v) => setQ(i, { prompt: v })} multiline />
          <TextField label={t('mobile.quiz.pointsLabel')} value={q.points} onChangeText={(v) => setQ(i, { points: v.trim() })} keyboardType="decimal-pad" />
          {q.kind === 'mcq' ? (
            <View style={{ gap: spacing[2] }}>
              <Text variant="small" tone="muted">
                {t('mobile.quiz.optionsHint')}
              </Text>
              {q.options.map((o, k) => (
                <Row key={k}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: o.isCorrect }}
                    accessibilityLabel={t('mobile.quiz.markCorrect')}
                    onPress={() => setQ(i, { options: q.options.map((x, m) => ({ ...x, isCorrect: m === k })) })}
                    hitSlop={8}
                  >
                    <Ionicons name={o.isCorrect ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={o.isCorrect ? colors.success.fg : colors.subtle} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <TextField label={t('mobile.quiz.optionN', { n: k + 1 })} value={o.text} onChangeText={(v) => setQ(i, { options: q.options.map((x, m) => (m === k ? { ...x, text: v } : x)) })} />
                  </View>
                </Row>
              ))}
              {q.options.length < 8 && <Button small variant="ghost" icon="add" title={t('mobile.quiz.addOption')} onPress={() => setQ(i, { options: [...q.options, { text: '', isCorrect: false }] })} style={{ alignSelf: 'flex-start' }} />}
            </View>
          ) : (
            <TextField label={t('mobile.quiz.guidance')} value={q.guidance} onChangeText={(v) => setQ(i, { guidance: v })} multiline hint={t('mobile.quiz.guidanceHint')} />
          )}
        </Card>
      ))}
      <Button variant="secondary" icon="add" title={t('mobile.quiz.addQuestion')} onPress={() => setQuestions((qs) => [...qs, blankQuestion()])} />
      <InlineError error={create.error} />
    </Screen>
  );
}
