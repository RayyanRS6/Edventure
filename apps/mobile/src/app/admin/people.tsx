import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { z } from '@edventure/contracts';
import type { searchResults } from '@edventure/contracts';
import { useApi } from '@/lib/queries';
import { Card, Divider, ListRow, TextField } from '@/ui/controls';
import { EmptyState, Loading, Screen, SectionTitle } from '@/ui/screen';
import { spacing } from '@/ui/theme';

/** Find a student or teacher by name, admission number or employee number. */
export default function People() {
  const { t } = useTranslation();
  const router = useRouter();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const results = useApi<z.infer<typeof searchResults>>(['search', q], q.length >= 2 ? '/search' : null, { q });
  const students = results.data?.students ?? [];
  const teachers = results.data?.teachers ?? [];

  return (
    <Screen>
      <TextField label={t('common.search')} value={text} onChangeText={setText} placeholder={t('mobile.people.searchHint')} autoCorrect={false} returnKeyType="search" />
      {q.length < 2 ? (
        <EmptyState icon="search-outline" title={t('mobile.people.searchTitle')} hint={t('mobile.people.searchHint')} />
      ) : results.isLoading ? (
        <Loading />
      ) : students.length + teachers.length === 0 ? (
        <EmptyState title={t('common.noResults')} />
      ) : (
        <>
          {students.length > 0 && (
            <>
              <SectionTitle>{t('nav.students')}</SectionTitle>
              <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
                {students.map((s, i) => (
                  <View key={s.id}>
                    {i > 0 && <Divider />}
                    <ListRow icon="person-outline" title={s.displayName} subtitle={[s.admissionNumber, s.detail].filter(Boolean).join(' · ')} onPress={() => router.push(`/person/student/${s.id}`)} />
                  </View>
                ))}
              </Card>
            </>
          )}
          {teachers.length > 0 && (
            <>
              <SectionTitle>{t('nav.teachers')}</SectionTitle>
              <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
                {teachers.map((s, i) => (
                  <View key={s.id}>
                    {i > 0 && <Divider />}
                    <ListRow icon="briefcase-outline" title={s.displayName} subtitle={s.employeeNumber} onPress={() => router.push(`/person/teacher/${s.id}`)} />
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
