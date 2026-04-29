'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Appointment, Profile, Availability } from '@/lib/types'
import { ArrowLeft, CheckCircle2, PartyPopper, X } from 'lucide-react'

const HOURS = Array.from({ length: 14 }, (_, i) => i + 9) // 9~22

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export default function DatePage({
  params,
}: {
  params: Promise<{ appointmentId: string; date: string }>
}) {
  const { appointmentId, date } = use(params)
  const router = useRouter()

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
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
        supabase
          .from('availability')
          .select('*')
          .eq('appointment_id', appointmentId)
          .eq('date', date),
      ])

      if (aptRes.data) setAppointment(aptRes.data)
      if (profilesRes.data) setAllProfiles(profilesRes.data)
      if (availRes.data) setAvailability(availRes.data)
    }
    load()
  }, [appointmentId, currentProfile, date])

  useEffect(() => {
    if (!currentProfile) return

    const channel = supabase
      .channel(`availability-${appointmentId}-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability',
          filter: `appointment_id=eq.${appointmentId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (currentProfile && payload.new.profile_id === currentProfile.id) return
            if (payload.new.date !== date) return
            setAvailability((prev) => {
              const filtered = prev.filter(
                (a) =>
                  !(
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [appointmentId, currentProfile, date])

  async function toggleHour(hour: number) {
    if (!currentProfile) return

    const existing = availability.find(
      (a) => a.profile_id === currentProfile.id && a.date === date && a.hour === hour
    )

    if (existing) {
      setAvailability((prev) => prev.filter((a) => a.id !== existing.id))
      if (!existing.id.startsWith('temp-')) {
        await supabase.from('availability').delete().eq('id', existing.id)
      }
    } else {
      const tempId = `temp-${currentProfile.id}-${date}-${hour}`
      const optimistic: Availability = {
        id: tempId,
        appointment_id: appointmentId,
        profile_id: currentProfile.id,
        date,
        hour,
        created_at: new Date().toISOString(),
      }
      setAvailability((prev) => [...prev, optimistic])
      const { data } = await supabase
        .from('availability')
        .insert({
          appointment_id: appointmentId,
          profile_id: currentProfile.id,
          date,
          hour,
        })
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

  async function toggleAllDay() {
    if (!currentProfile) return

    const myHourSet = new Set(
      availability
        .filter((a) => a.profile_id === currentProfile.id && a.date === date)
        .map((a) => a.hour)
    )
    const allSelected = HOURS.every((h) => myHourSet.has(h))

    if (allSelected) {
      const myEntries = availability.filter(
        (a) => a.profile_id === currentProfile.id && a.date === date
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
        id: `temp-${currentProfile.id}-${date}-${h}`,
        appointment_id: appointmentId,
        profile_id: currentProfile.id,
        date,
        hour: h,
        created_at: new Date().toISOString(),
      }))
      setAvailability((prev) => [...prev, ...tempEntries])
      await Promise.all(
        missingHours.map(async (h) => {
          const tempId = `temp-${currentProfile.id}-${date}-${h}`
          const { data } = await supabase
            .from('availability')
            .insert({
              appointment_id: appointmentId,
              profile_id: currentProfile.id,
              date,
              hour: h,
            })
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

  function getBestHours(): number[] {
    if (allProfiles.length === 0) return []
    return HOURS.filter((h) => {
      const atHour = new Set(
        availability.filter((a) => a.date === date && a.hour === h).map((a) => a.profile_id)
      )
      return allProfiles.every((p) => atHour.has(p.id))
    })
  }

  function getHourInfo(hour: number) {
    const hourAvail = availability.filter((a) => a.date === date && a.hour === hour)
    const profileIds = new Set(hourAvail.map((a) => a.profile_id))
    const count = profileIds.size
    const ratio = allProfiles.length > 0 ? count / allProfiles.length : 0
    const isMyHour = currentProfile ? profileIds.has(currentProfile.id) : false
    const profiles = [...profileIds]
      .map((id) => allProfiles.find((p) => p.id === id))
      .filter(Boolean) as Profile[]
    return { count, ratio, isMyHour, profiles }
  }

  async function confirmDate() {
    setConfirming(true)
    const best = getBestHours()
    const startHour = Math.min(...best)
    const endHour = Math.max(...best)

    await supabase
      .from('appointments')
      .update({ confirmed_date: date, confirmed_start_hour: startHour, confirmed_end_hour: endHour })
      .eq('id', appointmentId)

    setAppointment((prev) =>
      prev
        ? { ...prev, confirmed_date: date, confirmed_start_hour: startHour, confirmed_end_hour: endHour }
        : prev
    )

    const saved = localStorage.getItem('moyeoyou_appointments')
    if (saved) {
      const list: Appointment[] = JSON.parse(saved)
      const updated = list.map((a) =>
        a.id === appointmentId
          ? { ...a, confirmed_date: date, confirmed_start_hour: startHour, confirmed_end_hour: endHour }
          : a
      )
      localStorage.setItem('moyeoyou_appointments', JSON.stringify(updated))
    }
    setConfirming(false)
  }

  const bestHours = getBestHours()
  const isConfirmed = appointment?.confirmed_date === date

  const myHourCount = currentProfile
    ? availability.filter((a) => a.profile_id === currentProfile.id && a.date === date).length
    : 0
  const isAllDay = myHourCount === HOURS.length

  const [, m, d] = date.split('-').map(Number)
  const dateLabel = `${m}월 ${d}일`

  const selectedProfiles =
    selectedHour !== null
      ? availability
          .filter((a) => a.date === date && a.hour === selectedHour)
          .map((a) => allProfiles.find((p) => p.id === a.profile_id))
          .filter(Boolean) as Profile[]
      : []

  const showBottomSheet = selectedHour !== null || (bestHours.length > 0 && !isConfirmed)

  return (
    <main className="flex flex-col min-h-screen max-w-md mx-auto w-full pb-48">
      <div className="px-5 pt-10 pb-4">
        <button
          onClick={() => router.push(`/${appointmentId}/calendar`)}
          className="flex items-center gap-1.5 text-gray-400 text-sm mb-4 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={16} />
          캘린더로
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-700">{appointment?.title}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{dateLabel}</p>
          </div>
          {currentProfile && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: currentProfile.color }}
            >
              {currentProfile.name[0]}
            </div>
          )}
        </div>

        {isConfirmed && appointment?.confirmed_start_hour != null && (
          <div className="bg-pink-50 border border-pink-200 rounded-xl px-4 py-2 mt-3 flex items-center gap-1.5">
            <PartyPopper size={15} className="text-pink-500" />
            <span className="text-pink-500 text-sm font-medium">
              {dateLabel}{' '}
              {formatHour(appointment.confirmed_start_hour!)}-{formatHour(appointment.confirmed_end_hour! + 1)}{' '}
              확정!
            </span>
          </div>
        )}
      </div>

      {!isConfirmed && (
        <div className="px-5 mb-4">
          <button
            onClick={toggleAllDay}
            className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isAllDay
                ? 'bg-pink-400 text-white'
                : 'border border-pink-200 text-pink-400 hover:bg-pink-50'
            }`}
          >
            {isAllDay ? '하루 종일 취소' : '하루 종일 가능'}
          </button>
        </div>
      )}

      <div className="px-5 space-y-1">
        {HOURS.map((hour) => {
          const { count, ratio, isMyHour } = getHourInfo(hour)
          const isBest = bestHours.includes(hour)
          const isSelected = selectedHour === hour

          const bgColor =
            ratio === 0
              ? 'bg-gray-50'
              : ratio < 0.34
              ? 'bg-pink-100'
              : ratio < 0.67
              ? 'bg-pink-200'
              : 'bg-pink-400'

          const labelColor = ratio >= 0.67 ? 'text-white' : 'text-gray-500'
          const countColor = ratio >= 0.67 ? 'text-white opacity-70' : 'text-gray-400'

          return (
            <button
              key={hour}
              onClick={() => {
                if (!isConfirmed) toggleHour(hour)
                setSelectedHour((prev) => (prev === hour ? null : hour))
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all active:scale-[0.98]
                ${bgColor}
                ${isSelected ? 'ring-2 ring-pink-400 ring-offset-1' : ''}
                ${isBest && !isSelected ? 'ring-2 ring-purple-300 ring-offset-1' : ''}
              `}
            >
              <span className={`text-sm w-12 text-left font-medium ${labelColor}`}>
                {formatHour(hour)}
              </span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {count > 0 && (
                  <span className={`text-xs ${countColor}`}>{count}명</span>
                )}
                {isBest && (
                  <span className="text-xs text-purple-500 font-medium ml-auto shrink-0">
                    모두 가능 ✓
                  </span>
                )}
              </div>
              {isMyHour && (
                <CheckCircle2
                  size={16}
                  className={ratio >= 0.67 ? 'text-white' : 'text-pink-400'}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="px-5 mt-4">
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
          <div className="flex items-center gap-1 ml-2">
            <div className="w-3 h-3 rounded ring-2 ring-purple-300 bg-white" />
            <span>전원 겹침</span>
          </div>
        </div>
      </div>

      {showBottomSheet && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 rounded-t-3xl px-5 py-5 shadow-lg z-20">
          {selectedHour !== null && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  {formatHour(selectedHour)} 가능한 친구
                </p>
                <button
                  onClick={() => setSelectedHour(null)}
                  className="text-gray-300 hover:text-gray-500 p-1"
                >
                  <X size={16} />
                </button>
              </div>
              {selectedProfiles.length === 0 ? (
                <p className="text-xs text-gray-400">아직 아무도 없어요</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {selectedProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: profile.color }}
                      >
                        {profile.name[0]}
                      </div>
                      <span className="text-xs text-gray-600">{profile.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {bestHours.length > 0 && !isConfirmed && (
            <button
              onClick={confirmDate}
              disabled={confirming}
              className="w-full bg-purple-400 text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <PartyPopper size={15} />
              {confirming
                ? '확정 중...'
                : `${dateLabel} ${formatHour(Math.min(...bestHours))}-${formatHour(Math.max(...bestHours) + 1)} 확정!`}
            </button>
          )}
        </div>
      )}
    </main>
  )
}
