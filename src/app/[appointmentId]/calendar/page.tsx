'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Appointment, Profile, Availability } from '@/lib/types'
import { ArrowLeft, ChevronLeft, ChevronRight, PartyPopper, X } from 'lucide-react'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function formatDateKo(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${m}월 ${d}일`
}

export default function CalendarPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = use(params)
  const router = useRouter()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])

  useEffect(() => {
    const saved = localStorage.getItem(`moyeoyou_profile_${appointmentId}`)
    if (!saved) {
      router.push(`/${appointmentId}`)
      return
    }
    setCurrentProfile(JSON.parse(saved))
  }, [appointmentId, router])

  useEffect(() => {
    if (!currentProfile) return

    async function load() {
      const [aptRes, profilesRes, availRes] = await Promise.all([
        supabase.from('appointments').select('*').eq('id', appointmentId).single(),
        supabase.from('profiles').select('*').eq('appointment_id', appointmentId),
        supabase.from('availability').select('*').eq('appointment_id', appointmentId),
      ])

      if (aptRes.data) setAppointment(aptRes.data)
      if (profilesRes.data) setAllProfiles(profilesRes.data)
      if (availRes.data) setAvailability(availRes.data)
    }
    load()
  }, [appointmentId, currentProfile])

  useEffect(() => {
    if (!currentProfile) return

    const channel = supabase
      .channel('availability-calendar')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availability', filter: `appointment_id=eq.${appointmentId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (currentProfile && payload.new.profile_id === currentProfile.id) return
            setAvailability((prev) => {
              const filtered = prev.filter(
                (a) => !(
                  a.profile_id === payload.new.profile_id &&
                  a.date === payload.new.date &&
                  a.hour === payload.new.hour
                )
              )
              return [...filtered, payload.new as Availability]
            })
          } else if (payload.eventType === 'DELETE') {
            setAvailability((prev) => prev.filter((a) => a.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [appointmentId, currentProfile])

  async function unconfirmDate() {
    await supabase.from('appointments').update({
      confirmed_date: null,
      confirmed_start_hour: null,
      confirmed_end_hour: null,
    }).eq('id', appointmentId)
    setAppointment((prev) => prev ? {
      ...prev,
      confirmed_date: null,
      confirmed_start_hour: null,
      confirmed_end_hour: null,
    } : prev)

    const saved = localStorage.getItem('moyeoyou_appointments')
    if (saved) {
      const list: Appointment[] = JSON.parse(saved)
      const updated = list.map((a) => a.id === appointmentId ? {
        ...a,
        confirmed_date: null,
        confirmed_start_hour: null,
        confirmed_end_hour: null,
      } : a)
      localStorage.setItem('moyeoyou_appointments', JSON.stringify(updated))
    }
  }

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay()

  function getDateInfo(dateStr: string) {
    const profileIds = new Set(
      availability.filter((a) => a.date === dateStr).map((a) => a.profile_id)
    )
    const count = profileIds.size
    const ratio = allProfiles.length > 0 ? count / allProfiles.length : 0
    const isMyDate = currentProfile ? profileIds.has(currentProfile.id) : false
    return { count, ratio, isMyDate }
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDay(year, month)

  return (
    <main className="flex flex-col min-h-screen max-w-md mx-auto w-full">
      <div className="px-5 pt-10 pb-4">
        <button
          onClick={() => router.push(`/${appointmentId}`)}
          className="flex items-center gap-1.5 text-gray-400 text-sm mb-4 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={16} />
          프로필 선택
        </button>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-gray-700 truncate flex-1 mr-2">
            {appointment?.title}
          </h1>
          {currentProfile && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: currentProfile.color }}
            >
              {currentProfile.name[0]}
            </div>
          )}
        </div>

        {appointment?.confirmed_date && (
          <div className="bg-pink-50 border border-pink-200 rounded-xl px-4 py-2 mb-4 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-pink-500 text-sm font-medium">
              <PartyPopper size={15} />
              {formatDateKo(appointment.confirmed_date)}
              {appointment.confirmed_start_hour != null && (
                ` ${formatHour(appointment.confirmed_start_hour)}-${formatHour(appointment.confirmed_end_hour! + 1)}`
              )}
              {' '}확정!
            </span>
            <button
              onClick={unconfirmDate}
              className="text-pink-300 hover:text-pink-500 ml-2 p-0.5"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      <div className="px-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              if (month === 0) { setYear(y => y - 1); setMonth(11) }
              else setMonth(m => m - 1)
            }}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-medium text-gray-700">
            {year}년 {month + 1}월
          </span>
          <button
            onClick={() => {
              if (month === 11) { setYear(y => y + 1); setMonth(0) }
              else setMonth(m => m + 1)
            }}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 py-1 font-medium">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = formatDate(year, month, day)
            const { count, ratio, isMyDate } = getDateInfo(dateStr)

            const bgColor = ratio === 0
              ? 'bg-transparent'
              : ratio < 0.34
              ? 'bg-pink-100'
              : ratio < 0.67
              ? 'bg-pink-200'
              : 'bg-pink-400'

            const textColor = ratio >= 0.67 ? 'text-white' : 'text-gray-700'

            return (
              <button
                key={dateStr}
                onClick={() => router.push(`/${appointmentId}/calendar/${dateStr}`)}
                className={`
                  aspect-square flex flex-col items-center justify-center rounded-xl mx-0.5
                  transition-all active:scale-90
                  ${bgColor} ${textColor}
                  ${isMyDate ? 'font-bold' : ''}
                `}
              >
                <span className="text-sm leading-none">{day}</span>
                {count > 0 && (
                  <span className="text-[9px] leading-none mt-0.5 opacity-70">{count}명</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 px-5">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-pink-100" />
            <span>소수</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-pink-200" />
            <span>절반</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-pink-400" />
            <span>모두</span>
          </div>
        </div>
      </div>
    </main>
  )
}
