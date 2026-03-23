'use client'

import { useState, useRef } from 'react'
import { trpc } from '@/lib/trpc'

// ─── Toast ───────────────────────────────────────────────────────────────────
function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const show = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }
  return { message, show }
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
      {message}
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />
  )
}

// ─── Profile Form ─────────────────────────────────────────────────────────────
function ProfileForm() {
  const toast = useToast()
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery()
  const utils = trpc.useUtils()

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.show('Perfil salvo')
      utils.user.getProfile.invalidate()
    },
  })

  const addSkill = trpc.user.addSkill.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  })

  const removeSkill = trpc.user.removeSkill.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  })

  const getUploadUrl = trpc.user.getUploadUrl.useMutation()
  const confirmCvUpload = trpc.user.confirmCvUpload.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  })

  const [skillInput, setSkillInput] = useState('')
  const [cvUploading, setCvUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Personal data form state ───────────────────────────────────────────
  const [form, setForm] = useState({
    name: '',
    phone: '',
    zipCode: '',
    linkedinUrl: '',
    desiredRole: '',
    minSalary: '',
  })

  // Sync form when profile loads
  const [synced, setSynced] = useState(false)
  if (profile && !synced) {
    setForm({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      zipCode: profile.zipCode ?? '',
      linkedinUrl: profile.linkedinUrl ?? '',
      desiredRole: profile.desiredRole ?? '',
      minSalary: profile.minSalary != null ? String(profile.minSalary) : '',
    })
    setSynced(true)
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    await updateProfile.mutateAsync({
      name: form.name || undefined,
      phone: form.phone || undefined,
      zipCode: form.zipCode || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      desiredRole: form.desiredRole || undefined,
      minSalary: form.minSalary ? Number(form.minSalary) : undefined,
    })
  }

  async function handleAddSkill() {
    const name = skillInput.trim()
    if (!name) return
    await addSkill.mutateAsync({ name })
    setSkillInput('')
  }

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.show('Apenas arquivos PDF são aceitos')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.show('O arquivo deve ter no máximo 5MB')
      return
    }

    setCvUploading(true)
    try {
      const { signedUrl } = await getUploadUrl.mutateAsync()
      await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/pdf' },
      })
      await confirmCvUpload.mutateAsync()
      toast.show('CV enviado com sucesso')
    } catch {
      toast.show('Erro ao enviar CV')
    } finally {
      setCvUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const skills = profile?.skills ?? []

  return (
    <>
      <Toast message={toast.message} />

      <div className="max-w-2xl mx-auto py-8 px-4 space-y-10">
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>

        {/* ── Personal data ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Dados pessoais</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {(
                [
                  { label: 'Nome', name: 'name', type: 'text', placeholder: 'Seu nome completo' },
                  { label: 'Telefone', name: 'phone', type: 'tel', placeholder: '+55 11 99999-9999' },
                  { label: 'CEP', name: 'zipCode', type: 'text', placeholder: '00000-000' },
                  { label: 'LinkedIn URL', name: 'linkedinUrl', type: 'url', placeholder: 'https://linkedin.com/in/...' },
                  { label: 'Cargo desejado', name: 'desiredRole', type: 'text', placeholder: 'Ex: Desenvolvedor Full Stack' },
                  { label: 'Salário mínimo (R$)', name: 'minSalary', type: 'number', placeholder: '5000' },
                ] as const
              ).map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleFormChange}
                    placeholder={field.placeholder}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                {updateProfile.isPending ? 'Salvando...' : 'Salvar perfil'}
              </button>
            </form>
          )}
        </section>

        {/* ── Skills ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Habilidades</h2>
          {isLoading ? (
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20" />
              ))}
            </div>
          ) : (
            <>
              {skills.length < 3 && (
                <p className="text-amber-600 text-sm mb-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Adicione pelo menos 3 habilidades para ativar a automação.
                </p>
              )}
              <div className="flex flex-wrap gap-2 mb-4">
                {skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full"
                  >
                    {skill.name}
                    <button
                      type="button"
                      onClick={() => removeSkill.mutate({ id: skill.id })}
                      className="text-gray-400 hover:text-gray-700 leading-none"
                      aria-label={`Remover ${skill.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                  placeholder="Ex: React, Node.js"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  disabled={addSkill.isPending || !skillInput.trim()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>
            </>
          )}
        </section>

        {/* ── CV Upload ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Currículo (CV)</h2>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="border border-gray-200 rounded-md p-4 space-y-3">
              {profile?.cvUrl ? (
                <p className="text-sm text-gray-600">
                  Arquivo atual:{' '}
                  <a
                    href={profile.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    cv.pdf
                  </a>
                </p>
              ) : (
                <p className="text-sm text-gray-500">Nenhum CV enviado ainda.</p>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleCvUpload}
                  className="hidden"
                  id="cv-upload"
                />
                <label
                  htmlFor="cv-upload"
                  className={`inline-block cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${cvUploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {cvUploading ? 'Enviando...' : profile?.cvUrl ? 'Substituir CV' : 'Enviar CV'}
                </label>
                <p className="text-xs text-gray-400 mt-1">PDF, máximo 5MB</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

export default function PerfilPage() {
  return <ProfileForm />
}
