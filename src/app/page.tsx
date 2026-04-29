'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Appointment } from '@/lib/types'
import { Plus, CalendarDays, CheckCircle2, Clock, X, Loader2 } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('moyeoyou_appointments')
    if (saved) {
      setMyAppointments(JSON.parse(saved))
    }
  }, [])

  async function createAppointment() {
    if (!title.trim()) return
    setCreating(true)

    const { data, error } = await supabase
      .from('appointments')
      .insert({ title: title.trim() })
      .select()
      .single()

    if (error || !data) {
      alert('약속 만들기에 실패했어요 😢')
      setCreating(false)
      return
    }

    const updated = [data, ...myAppointments]
    localStorage.setItem('moyeoyou_appointments', JSON.stringify(updated))
    router.push(`/${data.id}`)
  }

  function removeFromList(id: string) {
    const updated = myAppointments.filter((a) => a.id !== id)
    setMyAppointments(updated)
    localStorage.setItem('moyeoyou_appointments', JSON.stringify(updated))
  }

  return (
    <main className="flex flex-col min-h-screen px-5 pt-12 pb-8 max-w-md mx-auto w-full">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="text-pink-400" size={28} strokeWidth={2} />
          <h1 className="text-4xl font-bold text-pink-400">모여유</h1>
        </div>
        <p className="text-sm text-gray-400">친구들과 일정을 맞춰봐요</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-pink-100 mb-8">
        <p className="text-sm font-medium text-gray-600 mb-3">새 약속 만들기</p>
        <input
          type="text"
          placeholder="예: 5월 여행 날짜 잡기"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createAppointment()}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-pink-300 bg-gray-50 mb-3"
        />
        <button
          onClick={createAppointment}
          disabled={creating || !title.trim()}
          className="w-full bg-pink-400 hover:bg-pink-500 disabled:bg-gray-200 text-white rounded-xl py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {creating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              만드는 중...
            </>
          ) : (
            <>
              <Plus size={16} strokeWidth={2.5} />
              약속 만들기
            </>
          )}
        </button>
      </div>

      {myAppointments.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-500 mb-3">내 약속 목록</p>
          <div className="flex flex-col gap-3">
            {myAppointments.map((apt) => (
              <div
                key={apt.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-pink-50 flex items-center justify-between"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => router.push(`/${apt.id}`)}
                >
                  <p className="font-medium text-gray-700 text-sm">{apt.title}</p>
                  {apt.confirmed_date ? (
                    <span className="inline-flex items-center gap-1 text-xs text-pink-400 mt-0.5">
                      <CheckCircle2 size={11} />
                      {apt.confirmed_date} 확정!
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Clock size={11} />
                      날짜 조율 중...
                    </span>
                  )}
                </button>
                <button
                  onClick={() => removeFromList(apt.id)}
                  className="text-gray-300 hover:text-gray-500 ml-3 p-1"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {myAppointments.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <CalendarDays size={40} className="text-pink-200" strokeWidth={1.5} />
          <p className="text-gray-300 text-sm text-center">
            아직 약속이 없어요<br />새 약속을 만들어보세요
          </p>
        </div>
      )}
    </main>
  )
}
