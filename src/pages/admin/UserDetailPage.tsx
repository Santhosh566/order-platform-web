import {
  Alert,
  Anchor,
  Badge,
  Button,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconLock, IconLockOpen } from '@tabler/icons-react'
import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { errorMessage } from '../../lib/errors'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ROLE_COLORS, ROLE_LABELS, useSetActive, useUser, type UserDetail } from '../../admin/users'
import { Fact } from '../../components/order/OrderParts'
import { QueryState } from '../../components/QueryState'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format'
import { GENDER_LABELS, VEHICLE_LABELS } from '../../profile/types'
import { UserAvatar } from '../../profile/UserAvatar'
import { useAdjustWallet, useUserWallet } from '../../wallet/queries'
import { WalletHistory } from '../../wallet/WalletHistory'
import { DriverWarehouse } from '../../warehouses/ShipsFrom'

const dash = (value: string | null | undefined) => (value ? value : '—')

/** One user as an admin sees them: profile, and what they did as a customer or driver. Read-only. */
export function UserDetailPage() {
  const { userId = '' } = useParams()
  const user = useUser(userId)
  return (
    <Stack gap="md">
      <Anchor component={Link} to="/admin/users" size="sm">
        ← Users
      </Anchor>
      <QueryState query={user}>{(data) => <UserView detail={data} />}</QueryState>
    </Stack>
  )
}

function UserView({ detail }: { detail: UserDetail }) {
  const { profile, customer, driver } = detail
  return (
    <Grid gap="md">
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Paper withBorder radius="md" p="lg">
          <Stack align="center" gap="xs">
            <UserAvatar
              userId={profile.userId}
              name={profile.fullName}
              photoVersion={profile.hasPhoto ? profile.photoUpdatedAt : null}
              size={112}
            />
            <Title order={3} ta="center">
              {profile.fullName}
            </Title>
            <Group gap={4} justify="center">
              {profile.roles.map((r) => (
                <Badge key={r} variant="light" color={ROLE_COLORS[r]}>
                  {ROLE_LABELS[r]}
                </Badge>
              ))}
              {!detail.active && <Badge color="red">Inactive</Badge>}
            </Group>
          </Stack>
          <AccountStatus detail={detail} />
          <Stack gap={4} mt="md">
            <Fact label="User id" value={profile.userId} />
            <Fact label="Email" value={dash(profile.email)} />
            <Fact label="Mobile" value={dash(profile.phone)} />
            <Fact label="Member since" value={formatDate(profile.memberSince)} />
            <Fact label="Tier" value={detail.tier} />
            <Fact label="Signed in" value={detail.signInLinked ? 'Yes' : 'Not yet'} />
          </Stack>
        </Paper>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Stack gap="md">
          {customer && (
            <Section
              title="As a customer"
              action={
                <Anchor component={Link} to={`/admin/orders?q=${encodeURIComponent(profile.userId)}`} size="sm">
                  View orders
                </Anchor>
              }
            >
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                <Stat label="Orders" value={customer.orders} />
                <Stat label="Delivered" value={customer.delivered} />
                <Stat label="Cancelled" value={customer.cancelled} />
                <Stat label="Returns" value={customer.returns} />
              </SimpleGrid>
              <Fact label="Spent (after refunds)" value={formatMoney(customer.spent, 'INR')} />
              <Fact label="Last order" value={customer.lastOrderAt ? formatDateTime(customer.lastOrderAt) : '—'} />
              <Fact label="Date of birth" value={profile.customer?.dateOfBirth ? formatDate(profile.customer.dateOfBirth) : '—'} />
              <Fact label="Gender" value={profile.customer?.gender ? GENDER_LABELS[profile.customer.gender] : '—'} />
            </Section>
          )}
          {customer && <CustomerWallet userId={profile.userId} />}
          {driver && profile.driver && (
            <Section
              title="As a driver"
              action={
                <Anchor component={Link} to="/admin/deliveries" size="sm">
                  Driver performance
                </Anchor>
              }
            >
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                <Stat label="Deliveries" value={driver.deliveries} />
                <Stat label="Return pickups" value={driver.pickups} />
                <Stat label="Failed attempts" value={driver.failed} />
                <Stat
                  label="Rating"
                  value={driver.rating !== null ? `★ ${driver.rating.toFixed(1)}` : '—'}
                  hint={driver.ratingCount ? `${driver.ratingCount} ratings` : 'No ratings yet'}
                />
              </SimpleGrid>
              <DriverWarehouse userId={profile.userId} />
              <Fact label="Earned in total" value={formatMoney(driver.earnings, 'INR')} />
              <Fact label="Last delivery" value={driver.lastDeliveryAt ? formatDateTime(driver.lastDeliveryAt) : '—'} />
              <Fact
                label="Vehicle"
                value={profile.driver.vehicleType ? VEHICLE_LABELS[profile.driver.vehicleType] : 'Not given'}
              />
              <Fact label="Vehicle number" value={dash(profile.driver.vehicleNumber)} />
              <Fact label="Driving licence" value={dash(profile.driver.licenceNumber)} />
              <Fact
                label="Emergency contact"
                value={
                  profile.driver.emergencyContactName
                    ? `${profile.driver.emergencyContactName} · ${profile.driver.emergencyContactPhone}`
                    : '—'
                }
              />
              <Fact label="UPI ID" value={dash(profile.driver.upiId)} />
            </Section>
          )}
          {profile.staff && (
            <Section title="Work">
              <Fact label="Job title" value={dash(profile.staff.jobTitle)} />
              <Fact label="Department" value={dash(profile.staff.department)} />
            </Section>
          )}
          <Text size="xs" c="dimmed">
            Users change their own details from Edit profile; roles and passwords are managed in Keycloak.
          </Text>
        </Stack>
      </Grid.Col>
    </Grid>
  )
}

/**
 * Turn a customer or driver off, with a reason the next admin sees, or back on. Admin and service
 * accounts are managed in Keycloak, and nobody changes their own.
 */
function AccountStatus({ detail }: { detail: UserDetail }) {
  const auth = useAuth()
  const { profile } = detail
  const change = useSetActive(profile.userId)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const manageable =
    profile.userId !== auth.me?.userId && !profile.roles.includes('ADMIN') && !profile.roles.includes('SERVICE')
  const isDriver = profile.roles.includes('DELIVERY')

  const deactivate = () => {
    setTouched(true)
    if (reason.trim().length < 3) return
    change.mutate(
      { active: false, reason: reason.trim() },
      {
        onSuccess: (result) => {
          setOpen(false)
          setReason('')
          setTouched(false)
          const released = result.deliveriesReleased + result.pickupsReleased
          notifications.show({
            color: 'orange',
            title: `${profile.fullName} is inactive`,
            message:
              released > 0
                ? `${released} job${released === 1 ? '' : 's'} they had not started went back on the list.`
                : 'They can sign in but cannot use the app until you turn them back on.',
          })
        },
        onError: (error) => notifications.show({ color: 'red', title: 'Not deactivated', message: errorMessage(error) }),
      },
    )
  }
  const activate = () =>
    change.mutate(
      { active: true },
      {
        onSuccess: () =>
          notifications.show({ color: 'green', title: `${profile.fullName} is active`, message: 'They can use the app again.' }),
        onError: (error) => notifications.show({ color: 'red', title: 'Not activated', message: errorMessage(error) }),
      },
    )

  return (
    <Stack gap="xs" mt="md">
      {detail.deactivation && (
        <Alert color="red" icon={<IconLock size={18} />} title="Inactive" p="sm">
          <Text size="sm">{detail.deactivation.reason}</Text>
          <Text size="xs" c="dimmed">
            By {detail.deactivation.byName ?? detail.deactivation.by} on {formatDateTime(detail.deactivation.at)}
          </Text>
        </Alert>
      )}
      {manageable &&
        (detail.active ? (
          <Button variant="light" color="red" leftSection={<IconLock size={16} />} onClick={() => setOpen(true)}>
            Deactivate
          </Button>
        ) : (
          <Button color="green" leftSection={<IconLockOpen size={16} />} loading={change.isPending} onClick={activate}>
            Activate
          </Button>
        ))}
      <Modal opened={open} onClose={() => setOpen(false)} title={`Deactivate ${profile.fullName}?`}>
        <Stack gap="sm">
          <Text size="sm">
            They can still sign in, but every page will tell them they have no access and should contact the
            administrator. Orders already on their way carry on.
          </Text>
          {isDriver && (
            <Text size="sm">
              Jobs they have not started go back on the list for other drivers. If they are carrying a parcel, finish or
              fail that delivery first.
            </Text>
          )}
          <Textarea
            label="Reason"
            description="The next admin sees this."
            withAsterisk
            autosize
            minRows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            error={touched && reason.trim().length < 3 ? 'Give a reason' : undefined}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)} disabled={change.isPending}>
              Keep active
            </Button>
            <Button color="red" onClick={deactivate} loading={change.isPending}>
              Deactivate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

/** The customer's store credit, and giving or taking it back with a note the customer sees. */
function CustomerWallet({ userId }: { userId: string }) {
  const wallet = useUserWallet(userId)
  const [adjusting, setAdjusting] = useState<'credits' | 'debits' | null>(null)
  return (
    <Section
      title="Wallet"
      action={
        <Group gap="xs">
          <Button size="xs" variant="light" onClick={() => setAdjusting('credits')}>
            Add credit
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={() => setAdjusting('debits')}
            disabled={!wallet.data || wallet.data.balance <= 0}
          >
            Take back
          </Button>
        </Group>
      }
    >
      <QueryState query={wallet}>
        {(data) => (
          <>
            <Fact label="Balance" value={formatMoney(data.balance, data.currency)} />
            <WalletHistory
              entries={data.history.slice(0, 10)}
              currency={data.currency}
              orderLink={(id) => `/admin/orders/${encodeURIComponent(id)}`}
              showWho
            />
          </>
        )}
      </QueryState>
      <Modal
        opened={adjusting !== null}
        onClose={() => setAdjusting(null)}
        title={adjusting === 'debits' ? 'Take back store credit' : 'Add store credit'}
      >
        {adjusting && (
          <AdjustWallet
            userId={userId}
            direction={adjusting}
            balance={wallet.data?.balance ?? 0}
            onDone={() => setAdjusting(null)}
          />
        )}
      </Modal>
    </Section>
  )
}

function AdjustWallet({
  userId,
  direction,
  balance,
  onDone,
}: {
  userId: string
  direction: 'credits' | 'debits'
  balance: number
  onDone: () => void
}) {
  const adjust = useAdjustWallet(userId, direction)
  const [amount, setAmount] = useState<number | string>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    adjust.mutate(
      { amount: Number(amount), note: note.trim() },
      {
        onSuccess: (entry) => {
          notifications.show({
            color: 'green',
            message: `Done. The wallet now holds ${formatMoney(entry.balanceAfter)}.`,
          })
          onDone()
        },
        onError: (err) => setError(errorMessage(err)),
      },
    )
  }
  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <Text size="sm">
          {direction === 'credits'
            ? 'Store credit can be spent on any order paid online. It does not expire and is not paid out as cash.'
            : `Only for credit given by mistake. The wallet holds ${formatMoney(balance)}.`}
        </Text>
        <NumberInput
          label="Amount (₹)"
          value={amount}
          onChange={setAmount}
          min={1}
          max={direction === 'debits' ? balance : 25000}
          decimalScale={2}
          required
        />
        <Textarea
          label="Note"
          description="The customer sees it in their wallet history"
          placeholder={direction === 'credits' ? 'e.g. Sorry your order arrived late' : 'e.g. Credit given twice'}
          required
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        {error && (
          <Alert color="red" p="xs">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button
            type="submit"
            color={direction === 'debits' ? 'red' : undefined}
            loading={adjust.isPending}
            disabled={!note.trim() || !amount}
          >
            {direction === 'credits' ? 'Add credit' : 'Take back'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="lg">
      <Group justify="space-between" mb="sm">
        <Title order={4}>{title}</Title>
        {action}
      </Group>
      <Stack gap={6}>{children}</Stack>
    </Paper>
  )
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Paper withBorder radius="sm" p="xs">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="lg">
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  )
}
