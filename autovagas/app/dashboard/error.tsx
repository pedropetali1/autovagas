'use client'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-screen bg-[#111] text-[#e5e5e5]">
      <p className="text-lg mb-4">Algo deu errado. Tente recarregar a página.</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-[#b5ff4e] text-[#111] font-semibold hover:bg-[#c8ff6e] transition-colors"
      >
        Recarregar
      </button>
    </div>
  )
}
