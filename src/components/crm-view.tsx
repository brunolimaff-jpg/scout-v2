'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Users,
  Plus,
  Loader2,
  Edit,
  Trash2,
  Building2,
  Mail,
  Phone,
  ChevronRight,
  DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'

// ---------- Types ----------

interface PortaScoreData {
  id: string
  porte: number
  operacao: number
  retorno: number
  tecnologia: number
  adocao: number
  total: number
  sector?: string | null
  notes?: string | null
}

interface Investigation {
  id: string
  companyName: string
  sector?: string | null
  portaScore?: PortaScoreData | null
}

interface CrmAccount {
  id: string
  companyName: string
  cnpj?: string | null
  sector?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  stage: string
  nextStep?: string | null
  notes?: string | null
  potentialValue?: number | null
  investigationId?: string | null
  createdAt: string
  updatedAt: string
  investigation?: Investigation | null
}

// ---------- Helpers ----------

const STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'negotiation', label: 'Negociação' },
  { value: 'closed_won', label: 'Fechado (Ganho)' },
  { value: 'closed_lost', label: 'Fechado (Perdido)' },
]

const SECTOR_OPTIONS = [
  { value: 'agro', label: 'Agro' },
  { value: 'construction', label: 'Construção' },
  { value: 'retail', label: 'Varejo' },
  { value: 'industry', label: 'Indústria' },
  { value: 'services', label: 'Serviços' },
  { value: 'logistics', label: 'Logística' },
]

const SECTOR_LABELS: Record<string, string> = Object.fromEntries(
  SECTOR_OPTIONS.map((s) => [s.value, s.label])
)

const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.value, s.label])
)

const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  qualified: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  proposal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  negotiation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  closed_won: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed_lost: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
}

const PIPELINE_ORDER = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

// ---------- Component ----------

export function CrmView() {
  const [accounts, setAccounts] = useState<CrmAccount[]>([])
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CrmAccount | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('pipeline')

  // Form state
  const [formCompanyName, setFormCompanyName] = useState('')
  const [formCnpj, setFormCnpj] = useState('')
  const [formSector, setFormSector] = useState('')
  const [formContactName, setFormContactName] = useState('')
  const [formContactEmail, setFormContactEmail] = useState('')
  const [formContactPhone, setFormContactPhone] = useState('')
  const [formStage, setFormStage] = useState('lead')
  const [formNextStep, setFormNextStep] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formPotentialValue, setFormPotentialValue] = useState('')

  // Load accounts
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/accounts')
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts || [])
      }
    } catch {
      // silent
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  // Reset form
  const resetForm = () => {
    setFormCompanyName('')
    setFormCnpj('')
    setFormSector('')
    setFormContactName('')
    setFormContactEmail('')
    setFormContactPhone('')
    setFormStage('lead')
    setFormNextStep('')
    setFormNotes('')
    setFormPotentialValue('')
  }

  // Populate form for editing
  const populateForm = (account: CrmAccount) => {
    setFormCompanyName(account.companyName)
    setFormCnpj(account.cnpj || '')
    setFormSector(account.sector || '')
    setFormContactName(account.contactName || '')
    setFormContactEmail(account.contactEmail || '')
    setFormContactPhone(account.contactPhone || '')
    setFormStage(account.stage)
    setFormNextStep(account.nextStep || '')
    setFormNotes(account.notes || '')
    setFormPotentialValue(account.potentialValue?.toString() || '')
  }

  // Create account
  const handleCreate = async () => {
    if (!formCompanyName.trim()) {
      toast.error('Nome da empresa é obrigatório')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/crm/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formCompanyName.trim(),
          cnpj: formCnpj.trim() || undefined,
          sector: formSector || undefined,
          contactName: formContactName.trim() || undefined,
          contactEmail: formContactEmail.trim() || undefined,
          contactPhone: formContactPhone.trim() || undefined,
          stage: formStage,
          nextStep: formNextStep.trim() || undefined,
          notes: formNotes.trim() || undefined,
          potentialValue: formPotentialValue ? Number(formPotentialValue) : undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao criar conta')
      }

      toast.success('Conta criada com sucesso!')
      setShowCreateDialog(false)
      resetForm()
      loadAccounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar conta')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update account
  const handleUpdate = async () => {
    if (!editingAccount) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/crm/accounts/${editingAccount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formCompanyName.trim(),
          cnpj: formCnpj.trim() || null,
          sector: formSector || null,
          contactName: formContactName.trim() || null,
          contactEmail: formContactEmail.trim() || null,
          contactPhone: formContactPhone.trim() || null,
          stage: formStage,
          nextStep: formNextStep.trim() || null,
          notes: formNotes.trim() || null,
          potentialValue: formPotentialValue ? Number(formPotentialValue) : null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao atualizar conta')
      }

      toast.success('Conta atualizada!')
      setEditingAccount(null)
      resetForm()
      loadAccounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete account
  const deleteAccount = async (id: string) => {
    try {
      const res = await fetch(`/api/crm/accounts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id))
        toast.success('Conta excluída')
      }
    } catch {
      toast.error('Erro ao excluir conta')
    }
  }

  // Quick stage update
  const updateStage = async (accountId: string, newStage: string) => {
    try {
      const res = await fetch(`/api/crm/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      if (res.ok) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === accountId ? { ...a, stage: newStage } : a))
        )
        toast.success('Estágio atualizado!')
      }
    } catch {
      toast.error('Erro ao atualizar estágio')
    }
  }

  // Pipeline view data
  const pipelineAccounts = PIPELINE_ORDER.reduce(
    (acc, stage) => {
      acc[stage] = accounts.filter((a) => a.stage === stage)
      return acc
    },
    {} as Record<string, CrmAccount[]>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">CRM</h2>
              <p className="text-xs text-muted-foreground">Gestão de Contas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <button
                className={`px-3 py-1 text-xs ${
                  viewMode === 'pipeline'
                    ? 'bg-amber-100 dark:bg-amber-900/30 font-medium'
                    : 'bg-background'
                }`}
                onClick={() => setViewMode('pipeline')}
              >
                Pipeline
              </button>
              <button
                className={`px-3 py-1 text-xs ${
                  viewMode === 'table'
                    ? 'bg-amber-100 dark:bg-amber-900/30 font-medium'
                    : 'bg-background'
                }`}
                onClick={() => setViewMode('table')}
              >
                Lista
              </button>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Conta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Conta</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Nome da Empresa *</Label>
                      <Input
                        value={formCompanyName}
                        onChange={(e) => setFormCompanyName(e.target.value)}
                        placeholder="Empresa X LTDA"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CNPJ</Label>
                      <Input
                        value={formCnpj}
                        onChange={(e) => setFormCnpj(e.target.value)}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Setor</Label>
                      <Select value={formSector} onValueChange={setFormSector}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTOR_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Estágio</Label>
                      <Select value={formStage} onValueChange={setFormStage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Contato</Label>
                      <Input
                        value={formContactName}
                        onChange={(e) => setFormContactName(e.target.value)}
                        placeholder="Nome"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input
                        value={formContactEmail}
                        onChange={(e) => setFormContactEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <Input
                        value={formContactPhone}
                        onChange={(e) => setFormContactPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Próximo Passo</Label>
                      <Input
                        value={formNextStep}
                        onChange={(e) => setFormNextStep(e.target.value)}
                        placeholder="Agendar reunião..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor Potencial (R$)</Label>
                      <Input
                        type="number"
                        value={formPotentialValue}
                        onChange={(e) => setFormPotentialValue(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notas</Label>
                    <Textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Observações..."
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={isSubmitting || !formCompanyName.trim()}
                    className="w-full bg-amber-600 hover:bg-amber-700"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Criar Conta
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingAccount}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAccount(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome da Empresa *</Label>
                <Input
                  value={formCompanyName}
                  onChange={(e) => setFormCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <Input value={formCnpj} onChange={(e) => setFormCnpj(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Select value={formSector} onValueChange={setFormSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estágio</Label>
                <Select value={formStage} onValueChange={setFormStage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Contato</Label>
                <Input value={formContactName} onChange={(e) => setFormContactName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={formContactEmail} onChange={(e) => setFormContactEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={formContactPhone} onChange={(e) => setFormContactPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Próximo Passo</Label>
                <Input value={formNextStep} onChange={(e) => setFormNextStep(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor Potencial (R$)</Label>
                <Input
                  type="number"
                  value={formPotentialValue}
                  onChange={(e) => setFormPotentialValue(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} />
            </div>
            <Button
              onClick={handleUpdate}
              disabled={isSubmitting || !formCompanyName.trim()}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Edit className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4">
          {isLoadingList ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta no CRM.
                </p>
                <p className="text-xs text-muted-foreground">
                  Investigações com score alto podem se tornar contas.
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'pipeline' ? (
            /* Pipeline View */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {PIPELINE_ORDER.map((stage) => {
                const stageAccounts = pipelineAccounts[stage] || []
                return (
                  <div key={stage} className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                      <Badge className={`text-[10px] ${STAGE_COLORS[stage]}`}>
                        {STAGE_LABELS[stage]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {stageAccounts.length}
                      </span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {stageAccounts.map((account) => (
                        <Card
                          key={account.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                        >
                          <CardContent className="p-3 space-y-1.5">
                            <p className="font-medium text-xs truncate">
                              {account.companyName}
                            </p>
                            {account.sector && (
                              <Badge variant="outline" className="text-[9px]">
                                {SECTOR_LABELS[account.sector]}
                              </Badge>
                            )}
                            {account.contactName && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {account.contactName}
                              </p>
                            )}
                            {account.potentialValue != null && (
                              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                                <DollarSign className="h-2.5 w-2.5" />
                                R$ {account.potentialValue.toLocaleString('pt-BR')}
                              </p>
                            )}
                            {account.nextStep && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                → {account.nextStep}
                              </p>
                            )}
                            <div className="flex items-center gap-1 pt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={() => {
                                  setEditingAccount(account)
                                  populateForm(account)
                                }}
                              >
                                <Edit className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-rose-500"
                                onClick={() => deleteAccount(account.id)}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                              {/* Quick stage advance */}
                              {(() => {
                                const currentIdx = PIPELINE_ORDER.indexOf(account.stage)
                                const nextStage = PIPELINE_ORDER[currentIdx + 1]
                                if (nextStage && account.stage !== 'closed_won' && account.stage !== 'closed_lost') {
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0 text-emerald-500 ml-auto"
                                      onClick={() => updateStage(account.id, nextStage)}
                                    >
                                      <ChevronRight className="h-3 w-3" />
                                    </Button>
                                  )
                                }
                                return null
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Table/List View */
            <div className="space-y-2">
              {accounts.map((account) => (
                <Card key={account.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="font-medium text-sm truncate">
                            {account.companyName}
                          </p>
                          <Badge className={`text-[10px] ${STAGE_COLORS[account.stage]}`}>
                            {STAGE_LABELS[account.stage]}
                          </Badge>
                          {account.sector && (
                            <Badge variant="outline" className="text-[10px]">
                              {SECTOR_LABELS[account.sector]}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {account.contactName && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {account.contactName}
                            </span>
                          )}
                          {account.contactEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {account.contactEmail}
                            </span>
                          )}
                          {account.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {account.contactPhone}
                            </span>
                          )}
                          {account.potentialValue != null && (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <DollarSign className="h-3 w-3" />
                              R$ {account.potentialValue.toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                        {account.nextStep && (
                          <p className="text-xs text-muted-foreground">
                            Próximo: {account.nextStep}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingAccount(account)
                            populateForm(account)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-500"
                          onClick={() => deleteAccount(account.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
