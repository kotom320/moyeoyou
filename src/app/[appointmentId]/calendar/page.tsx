'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Appointment, Profile, Availability } from '@/lib/types'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, X, PartyPopper } from 'lucide-react'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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
      .channel('availability')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availability', filter: `appointment_id=eq.${appointmentId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAvailability((prev) => [...prev, payload.new as Availability])
          } else if (payload.eventType === 'DELETE') {
            setAvailability((prev) => prev.filter((a) => a.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [appointmentId, currentProfile])

  async function toggleDate(dateStr: string) {
    if (!currentProfile) return

    const existing = availability.find(
      (a) => a.profile_id === currentProfile.id && a.date === dateStr
    )

    if (existing) {
      await supabase.from('availability').delete().eq('id', existing.id)
    } else {
      await supabase.from('availability').insert({
        appointment_id: appointmentId,
        profile_id: currentProfile.id,
        date: dateStr,
      })
    }
  }

  async function confirmDate(dateStr: string) {
    setConfirming(true)
    await supabase.from('appointments').update({ confirmed_date: dateStr }).eq('id', appointmentId)
    setAppointment((prev) => prev ? { ...prev, confirmed_date: dateStr } : prev)

    const saved = localStorage.getItem('moyeoyou_appointments')
    if (saved) {
      const list: Appointment[] = JSON.parse(saved)
      const updated = list.map((a) => a.id === appointmentId ? { ...a, confirmed_date: dateStr } : a)
      localStorage.setItem('moyeoyou_appointments', JSON.stringify(updated))
    }
    setConfirming(false)
  }

  async function unconfirmDate() {
    await supabase.from('appointments').update({ confirmed_date: null }).eq('id', appointmentId)
    setAppointment((prev) => prev ? { ...prev, confirmed_date: null } : prev)

    const saved = localStorage.getItem('moyeoyou_appointments')
    if (saved) {
      const list: Appointment[] = JSON.parse(saved)
      const updated = list.map((a) => a.id === appointmentId ? { ...a, confirmed_date: null } : a)
      localStorage.setItem('moyeoyou_appointments', JSON.stringify(updated))
    }
  }

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay()

  function getDateInfo(dateStr: string) {
    const dateAvail = availability.filter((a) => a.date === dateStr)
    const myAvail = currentProfile ? dateAvail.find((a) => a.profile_id === currentProfile.id) : null
    const count = dateAvail.length
    const ratio = allProfiles.length > 0 ? count / allProfiles.length : 0
    return { count, ratio, isMyDate: !!myAvail, profiles: dateAvail.map((a) => a.profile_id) }
  }

  function getSelectedDateProfiles() {
    if (!selectedDate) return []
    return availability
      .filter((a) => a.date === selectedDate)
      .map((a) => allProfiles.find((p) => p.id === a.profile_id))
      .filter(Boolean) as Profile[]
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
              {appointment.confirmed_date} 확정!
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
              setSelectedDate(null)
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
              setSelectedDate(null)
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
            const isSelected = selectedDate === dateStr

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
            <span>1명</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-pink-200" />
            <span>2명</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-pink-400" />
            <span>모두</span>
          </div>
        </div>
      </div>

      {selectedDate && (
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 rounded-t-3xl px-5 py-5 shadow-lg z-20">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">
                {selectedDate.replace(/-/g, '.')} 가능한 친구
              </p>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-300 hover:text-gray-500 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {getSelectedDateProfiles().length === 0 ? (
              <p className="text-xs text-gray-400 mb-4">아직 아무도 없어요</p>
            ) : (
              <div className="flex gap-2 flex-wrap mb-4">
                {getSelectedDateProfiles().map((profile) => (
                  <div key={profile.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5">
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

            {(() => {
              const isMyDate = currentProfile
                ? availability.some((a) => a.profile_id === currentProfile.id && a.date === selectedDate)
                : false
              const allAvailable = getSelectedDateProfiles().length === allProfiles.length && allProfiles.length > 0

              return (
                <div className="flex gap-2">
                  <button
                    onClick={() => !appointment?.confirmed_date && toggleDate(selectedDate)}
                    disabled={!!appointment?.confirmed_date}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                      appointment?.confirmed_date
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : isMyDate
                        ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        : 'bg-pink-400 text-white hover:bg-pink-500'
                    }`}
                  >
                    {isMyDate ? '나 빠질게요' : '나도 가능해요!'}
                  </button>
                  {allAvailable && !appointment?.confirmed_date && (
                    <button
                      onClick={() => confirmDate(selectedDate)}
                      disabled={confirming}
                      className="flex-1 bg-purple-400 text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-1.5"
                    >
                      <PartyPopper size={15} />
                      {confirming ? '확정 중...' : '이 날로 확정!'}
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
      )}
    </main>
  )
}
