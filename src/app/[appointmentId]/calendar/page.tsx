'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Appointment, Profile, Availability } from '@/lib/types'
import { ArrowLeft, ChevronLeft, ChevronRight, PartyPopper, X, CheckCircle2 } from 'lucide-react'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 9) // 9~22

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

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

  async function toggleHour(dateStr: string, hour: number) {
    if (!currentProfile) return

    const existing = availability.find(
      (a) => a.profile_id === currentProfile.id && a.date === dateStr && a.hour === hour
    )

    if (existing) {
      setAvailability((prev) => prev.filter((a) => a.id !== existing.id))
      if (!existing.id.startsWith('temp-')) {
        await supabase.from('availability').delete().eq('id', existing.id)
      }
    } else {
      const tempId = `temp-${currentProfile.id}-${dateStr}-${hour}`
      const optimistic: Availability = {
        id: tempId,
        appointment_id: appointmentId,
        profile_id: currentProfile.id,
        date: dateStr,
        hour,
        created_at: new Date().toISOString(),
      }
      setAvailability((prev) => [...prev, optimistic])
      const { data } = await supabase
        .from('availability')
        .insert({ appointment_id: appointmentId, profile_id: currentProfile.id, date: dateStr, hour })
        .select()
        .single()
      if (data) {
        setAvailability((prev) => {
          const tempStillExists = prev.some((a) => a.id === tempId)
          if (!tempStillExists) {
            supabase.from('availability').delete().eq('id', data.id)
            return prev
          }
          return prev.map((a) => (a.id === tempId ? data : a))
        })
      }
    }
  }

  async function toggleAllDay(dateStr: string) {
    if (!currentProfile) return

    const myHourSet = new Set(
      availability
        .filter((a) => a.profile_id === currentProfile.id && a.date === dateStr)
        .map((a) => a.hour)
    )
    const allSelected = HOURS.every((h) => myHourSet.has(h))

    if (allSelected) {
      const myEntries = availability.filter(
        (a) => a.profile_id === currentProfile.id && a.date === dateStr
      )
      const myIds = new Set(myEntries.map((a) => a.id))
      setAvailability((prev) => prev.filter((a) => !myIds.has(a.id)))
      await Promise.all(
        myEntries
          .filter((e) => !e.id.startsWith('temp-'))
          .map((e) => supabase.from('availability').delete().eq('id', e.id))
      )
    } else {
      const missingHours = HOURS.filter((h) => !myHourSet.has(h))
      const tempEntries: Availability[] = missingHours.map((h) => ({
        id: `temp-${currentProfile.id}-${dateStr}-${h}`,
        appointment_id: appointmentId,
        profile_id: currentProfile.id,
        date: dateStr,
        hour: h,
        created_at: new Date().toISOString(),
      }))
      setAvailability((prev) => [...prev, ...tempEntries])
      await Promise.all(
        missingHours.map(async (h) => {
          const tempId = `temp-${currentProfile.id}-${dateStr}-${h}`
          const { data } = await supabase
            .from('availability')
            .insert({ appointment_id: appointmentId, profile_id: currentProfile.id, date: dateStr, hour: h })
            .select()
            .single()
          if (data) {
            setAvailability((prev) => {
              const tempStillExists = prev.some((a) => a.id === tempId)
              if (!tempStillExists) {
                supabase.from('availability').delete().eq('id', data.id)
                return prev
              }
              return prev.map((a) => (a.id === tempId ? data : a))
            })
          }
        })
      )
    }
  }

  async function confirmDate(dateStr: string) {
    setConfirming(true)
    const best = getBestHours(dateStr)
    const startHour = Math.min(...best)
    const endHour = Math.max(...best)

    await supabase
      .from('appointments')
      .update({ confirmed_date: dateStr, confirmed_start_hour: startHour, confirmed_end_hour: endHour })
      .eq('id', appointmentId)

    setAppointment((prev) =>
      prev ? { ...prev, confirmed_date: dateStr, confirmed_start_hour: startHour, confirmed_end_hour: endHour } : prev
    )

    const saved = localStorage.getItem('moyeoyou_appointments')
    if (saved) {
      const list: Appointment[] = JSON.parse(saved)
      const updated = list.map((a) =>
        a.id === appointmentId
          ? { ...a, confirmed_date: dateStr, confirmed_start_hour: startHour, confirmed_end_hour: endHour }
          : a
      )
      localStorage.setItem('moyeoyou_appointments', JSON.stringify(updated))
    }
    setConfirming(false)
  }

  async function unconfirmDate() {
    await supabase
      .from('appointments')
      .update({ confirmed_date: null, confirmed_start_hour: null, confirmed_end_hour: null })
      .eq('id', appointmentId)
    setAppointment((prev) =>
      prev ? { ...prev, confirmed_date: null, confirmed_start_hour: null, confirmed_end_hour: null } : prev
    )

    const saved = localStorage.getItem('moyeoyou_appointments')
    if (saved) {
      const list: Appointment[] = JSON.parse(saved)
      const updated = list.map((a) =>
        a.id === appointmentId
          ? { ...a, confirmed_date: null, confirmed_start_hour: null, confirmed_end_hour: null }
          : a
      )
      localStorage.setItem('moyeoyou_appointments', JSON.stringify(updated))
    }
  }

  function getBestHours(dateStr: string): number[] {
    if (allProfiles.length === 0) return []
    return HOURS.filter((h) => {
      const atHour = new Set(
        availability.filter((a) => a.date === dateStr && a.hour === h).map((a) => a.profile_id)
      )
      return allProfiles.every((p) => atHour.has(p.id))
    })
  }

  function getDateInfo(dateStr: string) {
    const profileIds = new Set(availability.filter((a) => a.date === dateStr).map((a) => a.profile_id))
    const count = profileIds.size
    const ratio = allProfiles.length > 0 ? count / allProfiles.length : 0
    const isMyDate = currentProfile ? profileIds.has(currentProfile.id) : false
    const profiles = [...profileIds]
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter(Boolean) as Profile[]
    return { count, ratio, isMyDate, profiles }
  }

  function getHourInfo(dateStr: string, hour: number) {
    const profileIds = new Set(
      availability.filter((a) => a.date === dateStr && a.hour === hour).map((a) => a.profile_id)
    )
    const count = profileIds.size
    const ratio = allProfiles.length > 0 ? count / allProfiles.length : 0
    const isMyHour = currentProfile ? profileIds.has(currentProfile.id) : false
    const profiles = [...profileIds]
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter(Boolean) as Profile[]
    return { count, ratio, isMyHour, profiles }
  }

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay()

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDay(year, month)

  const sheetBestHours = selectedDate ? getBestHours(selectedDate) : []
  const isAnyConfirmed = !!appointment?.confirmed_date
  const isThisDateConfirmed = selectedDate ? appointment?.confirmed_date === selectedDate : false
  const myHourCount =
    selectedDate && currentProfile
      ? availability.filter((a) => a.profile_id === currentProfile.id && a.date === selectedDate).length
      : 0
  const isAllDay = myHourCount === HOURS.length

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
            <button onClick={unconfirmDate} className="text-pink-300 hover:text-pink-500 ml-2 p-0.5">
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
          <span className="font-medium text-gray-700">{year}년 {month + 1}월</span>
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
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = formatDate(year, month, day)
            const { ratio, isMyDate, profiles } = getDateInfo(dateStr)
            const isSelected = selectedDate === dateStr

            const bgColor =
              ratio === 0 ? 'bg-transparent'
              : ratio < 0.34 ? 'bg-pink-100'
              : ratio < 0.67 ? 'bg-pink-200'
              : 'bg-pink-400'

            const textColor = ratio >= 0.67 ? 'text-white' : 'text-gray-700'

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`
                  aspect-square flex flex-col items-center justify-center rounded-xl mx-0.5
                  transition-all active:scale-90
                  ${bgColor} ${textColor}
                  ${isSelected ? 'ring-2 ring-pink-400 ring-offset-1' : ''}
                  ${isMyDate ? 'font-bold' : ''}
                `}
              >
                <span className="text-sm leading-none">{day}</span>
                {profiles.length > 0 && (
                  <div className="flex justify-center mt-1">
                    {profiles.slice(0, 4).map((p, idx) => (
                      <div
                        key={p.id}
                        className="w-2 h-2 rounded-full ring-1 ring-white/60"
                        style={{
                          backgroundColor: p.color,
                          marginLeft: idx > 0 ? '-3px' : '0',
                        }}
                      />
                    ))}
                  </div>
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

      {/* Backdrop */}
      {selectedDate && (
        <div
          className="fixed inset-0 bg-black/20 z-10"
          onClick={() => setSelectedDate(null)}
        />
      )}

      {/* Time grid bottom sheet */}
      {selectedDate && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-3xl shadow-xl z-20 flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
            <div>
              <p className="text-base font-bold text-gray-700">{formatDateKo(selectedDate)}</p>
              {isThisDateConfirmed && appointment?.confirmed_start_hour != null && (
                <p className="text-xs text-pink-500 mt-0.5 flex items-center gap-1">
                  <PartyPopper size={11} />
                  {formatHour(appointment.confirmed_start_hour!)}-{formatHour(appointment.confirmed_end_hour! + 1)} 확정!
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-gray-300 hover:text-gray-500 p-1"
            >
              <X size={20} />
            </button>
          </div>

          {/* 하루 종일 button */}
          {!isAnyConfirmed && (
            <div className="px-5 pb-3 shrink-0">
              <button
                onClick={() => toggleAllDay(selectedDate)}
                className={`w-full py-2 rounded-xl text-sm font-medium transition-colors ${
                  isAllDay
                    ? 'bg-pink-400 text-white'
                    : 'border border-pink-200 text-pink-400 hover:bg-pink-50'
                }`}
              >
                {isAllDay ? '하루 종일 취소' : '하루 종일 가능'}
              </button>
            </div>
          )}

          {/* Scrollable hour list */}
          <div className="flex-1 overflow-y-auto px-5 pb-3">
            <div className="space-y-1">
              {HOURS.map((hour) => {
                const { ratio, isMyHour, profiles } = getHourInfo(selectedDate, hour)
                const isBest = sheetBestHours.includes(hour)

                const bgColor =
                  ratio === 0 ? 'bg-gray-50'
                  : ratio < 0.34 ? 'bg-pink-100'
                  : ratio < 0.67 ? 'bg-pink-200'
                  : 'bg-pink-400'

                const labelColor = ratio >= 0.67 ? 'text-white' : 'text-gray-500'

                return (
                  <button
                    key={hour}
                    onClick={() => !isAnyConfirmed && toggleHour(selectedDate, hour)}
                    disabled={isAnyConfirmed}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${!isAnyConfirmed ? 'active:scale-[0.98]' : ''}
                      ${bgColor}
                      ${isBest ? 'ring-2 ring-purple-300 ring-offset-1' : ''}
                    `}
                  >
                    <span className={`text-sm w-12 text-left font-medium shrink-0 ${labelColor}`}>
                      {formatHour(hour)}
                    </span>
                    <div className="flex-1 flex items-center gap-1 min-w-0">
                      {profiles.map((p) => (
                        <div
                          key={p.id}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ring-1 ring-white/40"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.name[0]}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isBest && (
                        <span className="text-xs text-purple-500 font-medium">모두 ✓</span>
                      )}
                      {isMyHour && (
                        <CheckCircle2
                          size={16}
                          className={ratio >= 0.67 ? 'text-white' : 'text-pink-400'}
                        />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Confirm button */}
          {sheetBestHours.length > 0 && !isAnyConfirmed && (
            <div className="px-5 py-4 shrink-0 border-t border-gray-100">
              <button
                onClick={() => confirmDate(selectedDate)}
                disabled={confirming}
                className="w-full bg-purple-400 text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <PartyPopper size={15} />
                {confirming
                  ? '확정 중...'
                  : `${formatDateKo(selectedDate)} ${formatHour(Math.min(...sheetBestHours))}-${formatHour(Math.max(...sheetBestHours) + 1)} 확정!`}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
