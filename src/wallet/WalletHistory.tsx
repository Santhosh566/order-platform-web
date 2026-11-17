import { Anchor, Table, Text } from '@mantine/core'
import { Link } from 'react-router'
import { formatDateTime, formatMoney } from '../lib/format'
import { WALLET_KINDS, type WalletEntry } from './queries'

/** A wallet's changes, newest first. Order links go to the customer's or the admin's order page. */
export function WalletHistory({
  entries,
  currency,
  orderLink,
  showWho = false,
}: {
  entries: WalletEntry[]
  currency: string
  orderLink: (orderId: string) => string
  showWho?: boolean
}) {
  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing yet.
      </Text>
    )
  }
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="xs" aria-label="Wallet history">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>When</Table.Th>
            <Table.Th>What</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
            <Table.Th ta="right">Balance</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {entries.map((e) => (
            <Table.Tr key={e.id}>
              <Table.Td>
                <Text size="sm">{formatDateTime(e.createdAt)}</Text>
                <Text size="xs" c="dimmed">
                  {e.reference}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{WALLET_KINDS[e.kind]}</Text>
                {e.orderId && (
                  <Anchor component={Link} to={orderLink(e.orderId)} size="xs">
                    Order {e.orderId.slice(0, 12)}…
                  </Anchor>
                )}
                {e.giftCardLastFour && (
                  <Text size="xs" c="dimmed">
                    Card ending {e.giftCardLastFour}
                  </Text>
                )}
                {e.note && !e.orderId && !e.giftCardLastFour && (
                  <Text size="xs" c="dimmed">
                    {e.note}
                  </Text>
                )}
                {showWho && e.createdBy && (
                  <Text size="xs" c="dimmed">
                    By {e.createdBy}
                  </Text>
                )}
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm" fw={600} c={e.amount > 0 ? 'green' : undefined}>
                  {e.amount > 0 ? '+ ' : '− '}
                  {formatMoney(Math.abs(e.amount), currency)}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm">{formatMoney(e.balanceAfter, currency)}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
