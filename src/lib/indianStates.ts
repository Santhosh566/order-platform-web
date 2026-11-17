/**
 * Indian states and union territories as the backend knows them (IndianState.java), with their
 * GST state codes. The address keeps the name; the backend also accepts the code or abbreviation.
 */
export interface IndianState {
  code: string
  name: string
  /** Other spellings the backend accepts, such as "KA". */
  aliases: readonly string[]
}

export const INDIAN_STATES: readonly IndianState[] = [
  { code: '35', name: 'Andaman and Nicobar Islands', aliases: ['AN'] },
  { code: '37', name: 'Andhra Pradesh', aliases: ['AP'] },
  { code: '12', name: 'Arunachal Pradesh', aliases: ['AR'] },
  { code: '18', name: 'Assam', aliases: ['AS'] },
  { code: '10', name: 'Bihar', aliases: ['BR'] },
  { code: '04', name: 'Chandigarh', aliases: ['CH'] },
  { code: '22', name: 'Chhattisgarh', aliases: ['CG', 'CT'] },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', aliases: ['DH', 'DN', 'DD'] },
  { code: '07', name: 'Delhi', aliases: ['DL', 'NCT OF DELHI', 'NEW DELHI'] },
  { code: '30', name: 'Goa', aliases: ['GA'] },
  { code: '24', name: 'Gujarat', aliases: ['GJ'] },
  { code: '06', name: 'Haryana', aliases: ['HR'] },
  { code: '02', name: 'Himachal Pradesh', aliases: ['HP'] },
  { code: '01', name: 'Jammu and Kashmir', aliases: ['JK'] },
  { code: '20', name: 'Jharkhand', aliases: ['JH'] },
  { code: '29', name: 'Karnataka', aliases: ['KA'] },
  { code: '32', name: 'Kerala', aliases: ['KL'] },
  { code: '38', name: 'Ladakh', aliases: ['LA'] },
  { code: '31', name: 'Lakshadweep', aliases: ['LD'] },
  { code: '23', name: 'Madhya Pradesh', aliases: ['MP'] },
  { code: '27', name: 'Maharashtra', aliases: ['MH'] },
  { code: '14', name: 'Manipur', aliases: ['MN'] },
  { code: '17', name: 'Meghalaya', aliases: ['ML'] },
  { code: '15', name: 'Mizoram', aliases: ['MZ'] },
  { code: '13', name: 'Nagaland', aliases: ['NL'] },
  { code: '21', name: 'Odisha', aliases: ['OD', 'OR', 'ORISSA'] },
  { code: '34', name: 'Puducherry', aliases: ['PY', 'PONDICHERRY'] },
  { code: '03', name: 'Punjab', aliases: ['PB'] },
  { code: '08', name: 'Rajasthan', aliases: ['RJ'] },
  { code: '11', name: 'Sikkim', aliases: ['SK'] },
  { code: '33', name: 'Tamil Nadu', aliases: ['TN'] },
  { code: '36', name: 'Telangana', aliases: ['TS', 'TG'] },
  { code: '16', name: 'Tripura', aliases: ['TR'] },
  { code: '09', name: 'Uttar Pradesh', aliases: ['UP'] },
  { code: '05', name: 'Uttarakhand', aliases: ['UK', 'UT'] },
  { code: '19', name: 'West Bengal', aliases: ['WB'] },
]

/** The state a stored value means: a name, GST code or abbreviation, in any case. */
export function findState(value: string | null | undefined): IndianState | undefined {
  const key = value?.trim().toUpperCase()
  if (!key) return undefined
  return INDIAN_STATES.find(
    (s) => s.code === key || s.name.toUpperCase() === key || s.aliases.some((a) => a.toUpperCase() === key),
  )
}

/** "29" → "Karnataka"; an unknown code is shown as it is. */
export function stateName(gstCode: string | null | undefined): string {
  if (!gstCode) return '—'
  return INDIAN_STATES.find((s) => s.code === gstCode)?.name ?? gstCode
}
