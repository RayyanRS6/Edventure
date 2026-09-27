import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { ReportJob, z } from '@edventure/contracts';
import type { myResult } from '@edventure/contracts';
import { api } from '@/lib/api';
import { openFile } from '@/lib/files';
import { formatDate, formatNumber, formatPercent, stateTone } from '@/lib/format';
import { useApi, useLang, useLocalized } from '@/lib/queries';
import { useMe } from '@/lib/session';
import { Badge, Button, Card, Divider, Row } from '@/ui/controls';
import { EmptyState, ErrorState, InlineError, Loading, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

type MyResult = z.infer<typeof myResult>;

/** Published results only; corrected revisions replace earlier ones and say so. */
export default function Results() {
  const { t } = useTranslation();
  const q = useApi<{ items: MyResult[] }>(['results', 'me'], '/results/me');
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: t('nav.results') }} />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data?.items.length ? (
        <EmptyState icon="ribbon-outline" title={t('mobile.results.none')} />
      ) : (
        q.data.items.map((r) => <ResultCard key={r.publicationId} result={r} />)
      )}
    </Screen>
  );
}

function ResultCard({ result: r }: { result: MyResult }) {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const res = r.result;

  /** Report cards are generated as PDFs by the background worker; wait briefly, then open. */
  const downloadCard = async () => {
    setBusy(true);
    setError(null);
    try {
      let job = await api.post<ReportJob>('/reports', { kind: 'report_card', format: 'pdf', locale: lang, parameters: { publicationId: r.publicationId, studentId: me.studentId ?? res.studentId } });
      for (let i = 0; i < 30 && (job.state === 'queued' || job.state === 'running'); i++) {
        await new Promise((ok) => setTimeout(ok, 2000));
        job = await api.get<ReportJob>(`/reports/${job.id}`);
      }
      if (job.state === 'succeeded' && job.fileId) await openFile(job.fileId, `report-card-${res.admissionNumber}.pdf`);
      else throw new Error(job.error ?? t('mobile.results.cardLater'));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{localized(r.examCycleName, r.examCycleNameUr)}</Text>
          <Text variant="small" tone="muted">
            {r.academicYearCode} · {formatDate(r.publishedAt, lang)}
            {r.revision > 1 ? ` · ${t('mobile.results.corrected')}` : ''}
          </Text>
        </View>
        <Badge tone={stateTone[res.outcome] ?? 'neutral'} label={t(`exams.${res.outcome}`)} />
      </Row>
      <Row gap={spacing[5]}>
        <View>
          <Text variant="caption" tone="muted">
            {t('exams.percentage')}
          </Text>
          <Text variant="title" latin>
            {formatPercent(res.percentage, 2)}
          </Text>
        </View>
        <View>
          <Text variant="caption" tone="muted">
            {t('exams.grade')}
          </Text>
          <Text variant="title" latin>
            {res.gradeLabel ?? '—'}
          </Text>
        </View>
        {res.gpa ? (
          <View>
            <Text variant="caption" tone="muted">
              GPA
            </Text>
            <Text variant="title" latin>
              {res.gpa}
            </Text>
          </View>
        ) : null}
      </Row>
      <Divider />
      {res.subjects.map((s) => (
        <Row key={s.courseOfferingId} style={{ justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>{localized(s.subjectName, s.subjectNameUr)}</Text>
          <Text latin tone="muted" variant="small">{`${formatNumber(s.obtainedMarks)}/${formatNumber(s.maxMarks)}`}</Text>
          <Text latin weight="600" style={{ width: 36, textAlign: 'center' }}>
            {s.gradeLabel ?? '—'}
          </Text>
        </Row>
      ))}
      {res.remarks ? (
        <Text variant="small" tone="soft">
          {res.remarks}
        </Text>
      ) : null}
      <InlineError error={error} />
      <Button variant="secondary" icon="download-outline" title={t('mobile.results.reportCard')} loading={busy} onPress={() => void downloadCard()} />
    </Card>
  );
}
