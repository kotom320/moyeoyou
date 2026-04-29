'use client'

import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

type ToastProps = {
  message: string
  onClose: () => void
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 bg-gray-800 text-white text-sm px-4 py-3 rounded-2xl shadow-lg">
        <CheckCircle2 size={16} className="text-pink-400 flex-shrink-0" />
        {message}
      </div>
    </div>
  )
}
