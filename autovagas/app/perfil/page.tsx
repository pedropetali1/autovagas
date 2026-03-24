'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
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

// ─── Toggle ──────────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 ${
          checked ? 'bg-gray-900' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  )
}

// ─── Profile Form ─────────────────────────────────────────────────────────────
function ProfileForm() {
  const t = useTranslations('perfil')
  const toast = useToast()
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery()
  const utils = trpc.useUtils()

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.show(t('toast.profileSaved'))
      utils.user.getProfile.invalidate()
    },
  })

  const addSkill = trpc.user.addSkill.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  })

  const removeSkill = trpc.user.removeSkill.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  })

  const updateNotificationPrefs = trpc.user.updateNotificationPrefs.useMutation({
    onSuccess: () => {
      toast.show(t('toast.notificationsSaved'))
      utils.user.getProfile.invalidate()
    },
  })

  const addExcludeCompany = trpc.user.addExcludeCompany.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  })

  const removeExcludeCompany = trpc.user.removeExcludeCompany.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  })

  const getUploadUrl = trpc.user.getUploadUrl.useMutation()
  const confirmCvUpload = trpc.user.confirmCvUpload.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate(),
  })

  const [skillInput, setSkillInput] = useState('')
  const [companyInput, setCompanyInput] = useState('')
  const [cvUploading, setCvUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Personal data form state ───────────────────────────────────────────
  const [form, setForm] = useState({
    name: '',
    phone: '',
    zipCode: '',
    linkedinUrl: '',
    desiredRole: '',
  })

  // ─── Notification prefs state ───────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    emailDigest: true,
    emailOnViewed: true,
    emailOnFailed: true,
  })

  // ─── Filtros state ──────────────────────────────────────────────────────
  const [minSalary, setMinSalary] = useState('')

  // Sync form when profile loads (once)
  const [synced, setSynced] = useState(false)
  if (profile && !synced) {
    setForm({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      zipCode: profile.zipCode ?? '',
      linkedinUrl: profile.linkedinUrl ?? '',
      desiredRole: profile.desiredRole ?? '',
    })
    setNotifPrefs({
      emailDigest: profile.emailDigest,
      emailOnViewed: profile.emailOnViewed,
      emailOnFailed: profile.emailOnFailed,
    })
    setMinSalary(profile.minSalary != null ? String(profile.minSalary) : '')
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
    })
  }

  async function handleSaveMinSalary(e: React.FormEvent) {
    e.preventDefault()
    await updateProfile.mutateAsync({
      minSalary: minSalary ? Number(minSalary) : undefined,
    })
    toast.show(t('toast.filtersSaved'))
  }

  async function handleNotifToggle(key: keyof typeof notifPrefs, value: boolean) {
    const updated = { ...notifPrefs, [key]: value }
    setNotifPrefs(updated)
    await updateNotificationPrefs.mutateAsync(updated)
  }

  async function handleAddSkill() {
    const name = skillInput.trim()
    if (!name) return
    await addSkill.mutateAsync({ name })
    setSkillInput('')
  }

  async function handleAddCompany() {
    const company = companyInput.trim()
    if (!company) return
    await addExcludeCompany.mutateAsync({ company })
    setCompanyInput('')
  }

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.show(t('toast.pdfOnly'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.show(t('toast.fileTooLarge'))
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
      toast.show(t('toast.cvUploaded'))
    } catch {
      toast.show(t('toast.cvError'))
    } finally {
      setCvUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const skills = profile?.skills ?? []
  const excludeCompanies = profile?.excludeCompanies ?? []

  return (
    <>
      <Toast message={toast.message} />

      <div className="max-w-2xl mx-auto py-8 px-4 space-y-10">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

        {/* ── Personal data ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('personalData.title')}</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {(
                [
                  { label: t('personalData.name'), name: 'name', type: 'text', placeholder: t('personalData.namePlaceholder') },
                  { label: t('personalData.phone'), name: 'phone', type: 'tel', placeholder: t('personalData.phonePlaceholder') },
                  { label: t('personalData.zipCode'), name: 'zipCode', type: 'text', placeholder: t('personalData.zipCodePlaceholder') },
                  { label: t('personalData.linkedinUrl'), name: 'linkedinUrl', type: 'url', placeholder: t('personalData.linkedinUrlPlaceholder') },
                  { label: t('personalData.desiredRole'), name: 'desiredRole', type: 'text', placeholder: t('personalData.desiredRolePlaceholder') },
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
                {updateProfile.isPending ? t('personalData.saving') : t('personalData.save')}
              </button>
            </form>
          )}
        </section>

        {/* ── Skills ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">{t('skills.title')}</h2>
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
                  {t('skills.warning')}
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
                      aria-label={t('skills.removeAriaLabel', { name: skill.name })}
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
                  placeholder={t('skills.placeholder')}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  disabled={addSkill.isPending || !skillInput.trim()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                >
                  {t('skills.add')}
                </button>
              </div>
            </>
          )}
        </section>

        {/* ── CV Upload ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">{t('cv.title')}</h2>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="border border-gray-200 rounded-md p-4 space-y-3">
              {profile?.cvUrl ? (
                <p className="text-sm text-gray-600">
                  {t('cv.currentFile')}{' '}
                  <a
                    href={profile.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {t('cv.fileName')}
                  </a>
                </p>
              ) : (
                <p className="text-sm text-gray-500">{t('cv.empty')}</p>
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
                  {cvUploading ? t('cv.uploading') : profile?.cvUrl ? t('cv.replace') : t('cv.upload')}
                </label>
                <p className="text-xs text-gray-400 mt-1">{t('cv.hint')}</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Notificações ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('notifications.title')}</h2>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <Toggle
                checked={notifPrefs.emailDigest}
                onChange={(v) => handleNotifToggle('emailDigest', v)}
                label={t('notifications.digest')}
              />
              <Toggle
                checked={notifPrefs.emailOnViewed}
                onChange={(v) => handleNotifToggle('emailOnViewed', v)}
                label={t('notifications.viewed')}
              />
              <Toggle
                checked={notifPrefs.emailOnFailed}
                onChange={(v) => handleNotifToggle('emailOnFailed', v)}
                label={t('notifications.failed')}
              />
            </div>
          )}
        </section>

        {/* ── Filtros ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('filters.title')}</h2>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-24" />
                ))}
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Salário mínimo */}
              <form onSubmit={handleSaveMinSalary} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t('filters.minSalary')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                    placeholder={t('filters.minSalaryPlaceholder')}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                  >
                    {t('filters.save')}
                  </button>
                </div>
              </form>

              {/* Empresas para excluir */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('filters.excludeCompanies')}
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {excludeCompanies.map((company) => (
                    <span
                      key={company}
                      className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-sm px-3 py-1 rounded-full"
                    >
                      {company}
                      <button
                        type="button"
                        onClick={() => removeExcludeCompany.mutate({ company })}
                        className="text-red-400 hover:text-red-700 leading-none"
                        aria-label={t('filters.removeAriaLabel', { company })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {excludeCompanies.length === 0 && (
                    <p className="text-sm text-gray-400">{t('filters.noCompanies')}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={companyInput}
                    onChange={(e) => setCompanyInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && (e.preventDefault(), handleAddCompany())
                    }
                    placeholder={t('filters.excludeCompaniesPlaceholder')}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddCompany}
                    disabled={addExcludeCompany.isPending || !companyInput.trim()}
                    className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                  >
                    {t('filters.exclude')}
                  </button>
                </div>
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
