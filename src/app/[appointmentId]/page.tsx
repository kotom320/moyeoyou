'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Appointment, Profile } from '@/lib/types'
import { AVATAR_COLORS } from '@/lib/types'

export default function AppointmentPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = use(params)
  const router = useRouter()
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function load() {
      const [aptRes, profilesRes] = await Promise.all([
        supabase.from('appointments').select('*').eq('id', appointmentId).single(),
        supabase.from('profiles').select('*').eq('appointment_id', appointmentId).order('created_at'),
      ])

      if (aptRes.data) setAppointment(aptRes.data)
      if (profilesRes.data) setProfiles(profilesRes.data)
      setLoading(false)
    }
    load()
  }, [appointmentId])

  function selectProfile(profile: Profile) {
    localStorage.setItem(`moyeoyou_profile_${appointmentId}`, JSON.stringify(profile))
    router.push(`/${appointmentId}/calendar`)
  }

  async function createProfile() {
    if (!newName.trim()) return
    setCreating(true)

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        appointment_id: appointmentId,
        name: newName.trim(),
        color: selectedColor,
      })
      .select()
      .single()

    if (error || !data) {
      alert('프로필 만들기 실패했어요 😢')
      setCreating(false)
      return
    }

    localStorage.setItem(`moyeoyou_profile_${appointmentId}`, JSON.stringify(data))
    router.push(`/${appointmentId}/calendar`)
  }

  function shareLink() {
    navigator.clipboard.writeText(window.location.href)
    alert('링크 복사됐어요! 친구들에게 공유하세요 🎉')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">약속을 찾을 수 없어요 😢</p>
      </div>
    )
  }

  return (
    <main className="flex flex-col min-h-screen px-5 pt-12 pb-8 max-w-md mx-auto w-full">
      <button
        onClick={() => router.push('/')}
        className="text-gray-400 text-sm mb-8 self-start"
      >
        ← 홈으로
      </button>

      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-700 mb-1">{appointment.title}</h1>
        {appointment.confirmed_date ? (
          <p className="text-pink-400 font-medium">✅ {appointment.confirmed_date} 확정!</p>
        ) : (
          <p className="text-gray-400 text-sm">누구로 입장할까요?</p>
        )}
      </div>

      {profiles.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => selectProfile(profile)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-sm border border-gray-100 hover:border-pink-200 transition-colors active:scale-95"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-sm"
                style={{ backgroundColor: profile.color }}
              >
                {profile.name[0]}
              </div>
              <span className="text-xs text-gray-600 font-medium truncate w-full text-center">
                {profile.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full border-2 border-dashed border-pink-200 rounded-2xl py-5 text-pink-300 text-sm hover:border-pink-300 hover:text-pink-400 transition-colors"
        >
          + 새 프로필 만들기
        </button>
      ) : (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-pink-100">
          <p className="text-sm font-medium text-gray-600 mb-4">새 프로필</p>
          <input
            type="text"
            placeholder="이름을 입력하세요"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createProfile()}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-pink-300 bg-gray-50 mb-4"
            autoFocus
          />
          <p className="text-xs text-gray-400 mb-2">색상 선택</p>
          <div className="flex gap-2 mb-4 flex-wrap">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className="w-8 h-8 rounded-full transition-transform"
                style={{
                  backgroundColor: color,
                  transform: selectedColor === color ? 'scale(1.2)' : 'scale(1)',
                  outline: selectedColor === color ? `2px solid ${color}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500"
            >
              취소
            </button>
            <button
              onClick={createProfile}
              disabled={creating || !newName.trim()}
              className="flex-1 py-3 rounded-xl bg-pink-400 text-white text-sm font-medium disabled:bg-gray-200 transition-colors"
            >
              {creating ? '만드는 중...' : '입장하기'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-auto pt-8">
        <button
          onClick={shareLink}
          className="w-full py-3 rounded-xl border border-pink-200 text-pink-400 text-sm font-medium"
        >
          링크 공유하기 🔗
        </button>
      </div>
    </main>
  )
}
