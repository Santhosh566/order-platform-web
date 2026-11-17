import { Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconGift, IconWallet } from '@tabler/icons-react'
import { useState } from 'react'
import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { useRedeemGiftCard, useWallet } from '../../wallet/queries'
import { WalletHistory } from '../../wallet/WalletHistory'

/** The customer's store credit: the balance, a gift card box, and every change. */
export function WalletPage() {
  const wallet = useWallet()
  return (
    <Stack gap="lg" maw={860}>
      <Title order={2}>Wallet</Title>
      <QueryState query={wallet}>
        {(data) => (
          <>
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                  <IconWallet size={32} stroke={1.4} />
                  <div>
                    <Text size="sm" c="dimmed">
                      Balance
                    </Text>
                    <Text fw={700} size="xl" aria-label="Wallet balance">
                      {formatMoney(data.balance, data.currency)}
                    </Text>
                    {data.available < data.balance && (
                      <Text size="xs" c="dimmed">
                        {formatMoney(data.balance - data.available, data.currency)} is set aside for an order being paid
                      </Text>
                    )}
                  </div>
                </Group>
                <Text size="xs" c="dimmed" maw={320}>
                  Use it at checkout for any order paid online. It does not expire. Refunds of orders paid
                  from the wallet come back here.
                </Text>
              </Group>
            </Paper>
            <RedeemGiftCard />
            <Paper withBorder radius="md" p="md">
              <Title order={4} mb="sm">
                History
              </Title>
              <WalletHistory
                entries={data.history}
                currency={data.currency}
                orderLink={(id) => `/orders/${encodeURIComponent(id)}`}
              />
            </Paper>
          </>
        )}
      </QueryState>
    </Stack>
  )
}

function RedeemGiftCard() {
  const redeem = useRedeemGiftCard()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    redeem.mutate(code.trim(), {
      onSuccess: (r) => {
        setCode('')
        notifications.show({
          color: 'green',
          title: 'Gift card added',
          message: `${formatMoney(r.amount)} is in your wallet. Balance: ${formatMoney(r.balance)}.`,
        })
      },
      onError: (e) => setError(errorMessage(e)),
    })
  }
  return (
    <Paper withBorder radius="md" p="md" component="form" onSubmit={submit}>
      <Stack gap="sm">
        <Group gap="xs">
          <IconGift size={20} />
          <Title order={4}>Add a gift card</Title>
        </Group>
        <Group align="flex-start" gap="sm">
          <TextInput
            label="Gift card code"
            placeholder="ABCD-EFGH-JKMN-PQRS"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            error={error}
            maxLength={24}
            autoComplete="off"
            style={{ flex: 1, minWidth: 220 }}
          />
          <Button type="submit" mt={25} loading={redeem.isPending} disabled={code.trim().length < 16}>
            Add to wallet
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          The whole value of the card goes into your wallet.
        </Text>
      </Stack>
    </Paper>
  )
}
