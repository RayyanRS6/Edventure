import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { FeeStatement } from '@edventure/contracts';
import { formatDate, formatMoney, formatMoneyAmount, stateTone } from '@/lib/format';
import { useLang } from '@/lib/queries';
import { Badge, Card, Divider, Row, Stat } from '@/ui/controls';
import { EmptyState, SectionTitle } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

/** Invoices, payments and balance for one student (student view and admin fee lookup). */
export function FeeStatementView({ s }: { s: FeeStatement }) {
  const { t } = useTranslation();
  const lang = useLang();
  const open = s.invoices.filter((i) => i.status === 'open');
  return (
    <>
      <Row style={{ alignItems: 'stretch' }} gap={spacing[3]}>
        <Stat style={{ minWidth: 0 }} label={t('fees.balance')} prefix={s.currency} value={formatMoneyAmount(s.totals.balance)} tone={Number(s.totals.overdue) > 0 ? 'danger' : undefined} hint={Number(s.totals.overdue) > 0 ? `${t('fees.overdue')}: ${formatMoney(s.totals.overdue, s.currency)}` : undefined} />
        <Stat style={{ minWidth: 0 }} label={t('fees.paidAmount')} prefix={s.currency} value={formatMoneyAmount(s.totals.paid)} hint={Number(s.totals.credit) > 0 ? t('mobile.fees.credit', { amount: formatMoney(s.totals.credit, s.currency) }) : undefined} />
      </Row>
      <SectionTitle>{t('mobile.fees.invoices')}</SectionTitle>
      {open.length === 0 ? (
        <EmptyState icon="checkmark-circle-outline" title={t('mobile.fees.none')} />
      ) : (
        <Card style={{ gap: 0 }}>
          {open.map((i, n) => (
            <View key={i.id} style={{ paddingVertical: spacing[3], gap: 4 }}>
              {n > 0 && <Divider />}
              <Row style={{ justifyContent: 'space-between' }}>
                <Text weight="600" latin>
                  {i.invoiceNumber}
                </Text>
                <Badge tone={i.overdue ? 'danger' : stateTone[i.feeStatus] ?? 'neutral'} label={i.overdue ? t('fees.overdue') : t(`fees.${i.feeStatus}`)} />
              </Row>
              <Text variant="small" tone="muted">
                {i.periodLabel} · {t('fees.dueDate')}: {formatDate(i.dueDate, lang)}
              </Text>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="small">{`${t('fees.amount')}: ${formatMoney(i.totalAmount, s.currency)}`}</Text>
                <Text variant="small" weight="600">{`${t('fees.balance')}: ${formatMoney(i.balance, s.currency)}`}</Text>
              </Row>
            </View>
          ))}
        </Card>
      )}
      {s.payments.length > 0 && (
        <>
          <SectionTitle>{t('mobile.fees.payments')}</SectionTitle>
          <Card style={{ gap: 0 }}>
            {s.payments.slice(0, 20).map((p, n) => (
              <View key={p.id} style={{ paddingVertical: spacing[3], gap: 2 }}>
                {n > 0 && <Divider />}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text latin weight="500">
                    {p.receiptNumber}
                  </Text>
                  <Text weight="600" style={p.status === 'reversed' ? { textDecorationLine: 'line-through' } : undefined}>
                    {formatMoney(p.amount, s.currency)}
                  </Text>
                </Row>
                <Text variant="small" tone="muted">
                  {formatDate(p.receivedOn, lang)}
                  {p.status === 'reversed' ? ` · ${t('mobile.fees.reversed')}` : ''}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
