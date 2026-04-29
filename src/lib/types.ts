export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: Appointment
        Insert: Omit<Appointment, 'id' | 'created_at'>
        Update: Partial<Omit<Appointment, 'id' | 'created_at'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      availability: {
        Row: Availability
        Insert: Omit<Availability, 'id' | 'created_at'>
        Update: Partial<Omit<Availability, 'id' | 'created_at'>>
      }
    }
  }
}

export type Appointment = {
  id: string
  title: string
  created_at: string
  confirmed_date: string | null
  confirmed_start_hour: number | null
  confirmed_end_hour: number | null
}

export type Profile = {
  id: string
  appointment_id: string
  name: string
  color: string
  created_at: string
}

export type Availability = {
  id: string
  appointment_id: string
  profile_id: string
  date: string
  hour: number
  created_at: string
}

export const AVATAR_COLORS = [
  '#FF9AA2',
  '#FFB7B2',
  '#FFDAC1',
  '#E2F0CB',
  '#B5EAD7',
  '#C7CEEA',
  '#DCD3F5',
  '#F2C4CE',
]
