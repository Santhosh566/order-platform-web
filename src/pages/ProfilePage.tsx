import { zodResolver } from '@hookform/resolvers/zod'
import {
  Badge,
  Button,
  FileButton,
  Grid,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCamera, IconTrash } from '@tabler/icons-react'
import { useMemo, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { QueryState } from '../components/QueryState'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'
import { profileSchema, toFormValues, toUpdate, type ProfileValues } from '../profile/profileSchema'
import { useMyProfile, useRemovePhoto, useSaveProfile, useUploadPhoto } from '../profile/queries'
import { GENDER_LABELS, isMotorised, VEHICLE_LABELS, type Profile, type VehicleType } from '../profile/types'
import { UserAvatar } from '../profile/UserAvatar'

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  DELIVERY: 'Delivery partner',
  ADMIN: 'Admin',
  SERVICE: 'Service',
}

const GENDER_OPTIONS = Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }))
const VEHICLE_OPTIONS = Object.entries(VEHICLE_LABELS).map(([value, label]) => ({ value, label }))
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/** Every user's own profile: photo, name and mobile, and the details that go with their role. */
export function ProfilePage() {
  const profile = useMyProfile()
  return (
    <Stack gap="md" maw={960}>
      <div>
        <Title order={2}>My profile</Title>
        <Text c="dimmed" size="sm">
          Your photo and details. Only you and our admins can see them.
        </Text>
      </div>
      <QueryState query={profile}>
        {(data) => (
          <Grid gap="md">
            <Grid.Col span={{ base: 12, md: 4 }}>
              <PhotoCard profile={data} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 8 }}>
              {/* Remounted after a save so the form shows what the server stored; a new photo leaves it alone */}
              <ProfileForm key={JSON.stringify(toFormValues(data))} profile={data} />
            </Grid.Col>
          </Grid>
        )}
      </QueryState>
    </Stack>
  )
}

function PhotoCard({ profile }: { profile: Profile }) {
  const upload = useUploadPhoto()
  const remove = useRemovePhoto()

  const choose = (file: File | null) => {
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      notifications.show({ color: 'red', title: 'Photo too large', message: 'Choose a picture of at most 5 MB.' })
      return
    }
    upload.mutate(file, {
      onSuccess: () => notifications.show({ color: 'green', title: 'Photo updated', message: 'Your new photo is saved.' }),
      onError: (error) => notifications.show({ color: 'red', title: 'Photo not saved', message: errorMessage(error) }),
    })
  }

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack align="center" gap="sm">
        <UserAvatar
          userId={profile.userId}
          name={profile.fullName}
          photoVersion={profile.hasPhoto ? profile.photoUpdatedAt : null}
          size={128}
        />
        <div style={{ textAlign: 'center' }}>
          <Text fw={600} size="lg">
            {profile.fullName}
          </Text>
          <Text size="sm" c="dimmed">
            {profile.email ?? 'No email'}
          </Text>
        </div>
        <Group gap={6} justify="center">
          {profile.roles
            .filter((role) => role !== 'SERVICE')
            .map((role) => (
              <Badge key={role} variant="light">
                {ROLE_LABELS[role] ?? role}
              </Badge>
            ))}
        </Group>
        <Group gap="xs" justify="center">
          <FileButton onChange={choose} accept="image/jpeg,image/png,image/webp">
            {(props) => (
              <Button {...props} size="xs" variant="light" leftSection={<IconCamera size={16} />} loading={upload.isPending}>
                {profile.hasPhoto ? 'Change photo' : 'Add photo'}
              </Button>
            )}
          </FileButton>
          {profile.hasPhoto && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, {
                  onError: (error) =>
                    notifications.show({ color: 'red', title: 'Photo not removed', message: errorMessage(error) }),
                })
              }
            >
              Remove
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed" ta="center">
          JPEG, PNG or WebP, up to 5 MB. We keep the middle square and remove location data.
        </Text>
        <Text size="xs" c="dimmed">
          {profile.userId} · member since {formatDate(profile.memberSince)}
        </Text>
      </Stack>
    </Paper>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const save = useSaveProfile()
  const customer = !!profile.customer
  const driver = !!profile.driver
  const staff = !!profile.staff
  const parts = { customer, driver, staff }
  const schema = useMemo(() => profileSchema({ customer, driver, staff }), [customer, driver, staff])
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(profile) })
  const vehicle = (useWatch({ control, name: 'vehicleType' }) || null) as VehicleType | null

  const submit = (values: ProfileValues) =>
    save.mutate(toUpdate(values, profile), {
      onSuccess: () => notifications.show({ color: 'green', title: 'Profile saved', message: 'Your details are up to date.' }),
      onError: (error) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
    })

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Stack gap="md">
        <Section title="Personal details">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput label="Full name" autoComplete="name" withAsterisk error={errors.fullName?.message} {...register('fullName')} />
            <TextInput
              label="Mobile number"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              withAsterisk={parts.driver}
              error={errors.phone?.message}
              {...register('phone')}
            />
          </SimpleGrid>
          <TextInput
            label="Email"
            value={profile.email ?? ''}
            readOnly
            description="Your sign-in email. Change it, or your password, in your account settings at sign-in."
          />
          {parts.customer && (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Date of birth"
                type="date"
                description="Optional. For birthday offers."
                error={errors.dateOfBirth?.message}
                {...register('dateOfBirth')}
              />
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select
                    label="Gender"
                    description="Optional"
                    data={GENDER_OPTIONS}
                    value={field.value || null}
                    onChange={(value) => field.onChange(value ?? '')}
                    clearable
                  />
                )}
              />
            </SimpleGrid>
          )}
          {parts.customer && (
            <Controller
              control={control}
              name="cartReminders"
              render={({ field }) => (
                <Switch
                  label="Cart reminders"
                  description="An email when you leave items in your cart, sometimes with an offer. Order emails are sent either way."
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          )}
        </Section>

        {parts.driver && (
          <>
            <Section title="Vehicle" description="Checked before you are paid for deliveries.">
              <Controller
                control={control}
                name="vehicleType"
                render={({ field }) => (
                  <Select
                    label="How do you deliver?"
                    data={VEHICLE_OPTIONS}
                    value={field.value || null}
                    onChange={(value) => field.onChange(value ?? '')}
                    withAsterisk
                    error={errors.vehicleType?.message}
                  />
                )}
              />
              {isMotorised(vehicle) && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput
                    label="Vehicle number"
                    placeholder="KA01AB1234"
                    withAsterisk
                    error={errors.vehicleNumber?.message}
                    {...register('vehicleNumber')}
                  />
                  <TextInput
                    label="Driving licence number"
                    placeholder="KA0120190001234"
                    withAsterisk
                    error={errors.licenceNumber?.message}
                    {...register('licenceNumber')}
                  />
                </SimpleGrid>
              )}
            </Section>
            <Section title="Emergency contact" description="Who we call if something happens to you on a delivery.">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput label="Name" error={errors.emergencyContactName?.message} {...register('emergencyContactName')} />
                <TextInput
                  label="Mobile number"
                  type="tel"
                  error={errors.emergencyContactPhone?.message}
                  {...register('emergencyContactPhone')}
                />
              </SimpleGrid>
            </Section>
            <Section title="Payouts">
              <TextInput
                label="UPI ID"
                placeholder="name@bank"
                description="Where your delivery earnings are paid."
                error={errors.upiId?.message}
                {...register('upiId')}
              />
            </Section>
          </>
        )}

        {parts.staff && (
          <Section title="Work">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput label="Job title" error={errors.jobTitle?.message} {...register('jobTitle')} />
              <TextInput label="Department" error={errors.department?.message} {...register('department')} />
            </SimpleGrid>
          </Section>
        )}

        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Save profile
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="sm">
        <div>
          <Title order={4}>{title}</Title>
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </div>
        {children}
      </Stack>
    </Paper>
  )
}
