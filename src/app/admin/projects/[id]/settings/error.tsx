"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="p-10 border-4 border-red-500 bg-red-50 m-10 rounded-xl max-w-4xl mx-auto shadow-2xl">
      <h2 className="text-3xl font-black text-red-700 mb-6">🚨 КРИТИЧЕСКАЯ ОШИБКА</h2>
      <p className="font-bold text-red-900 mb-2">Отправьте этот текст ИИ-ассистенту:</p>
      
      <div className="bg-white p-4 rounded border border-red-200 overflow-auto text-sm font-mono text-red-800 shadow-inner">
        <p className="font-bold mb-2">Message: {error.message}</p>
        <p className="whitespace-pre-wrap">{error.stack}</p>
      </div>
      
      <button
        className="mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded transition-colors"
        onClick={() => reset()}
      >
        Попробовать снова
      </button>
    </div>
  )
}
