'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { PortaScoreDisplay } from '@/components/porta-score-display'
import {
  Search,
  Loader2,
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  AlertTriangle,
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
  cnpj?: string | null
  sector?: string | null
  status: string
  summary?: string | null
  rawData?: string | null
  createdAt: string
  updatedAt: string
  portaScore?: PortaScoreData | null
}

// ---------- Helpers ----------

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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  investigating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  investigating: 'Investigando',
  completed: 'Concluída',
  failed: 'Falhou',
}

// ---------- Component ----------

export function ScoutView() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [sector, setSector] = useState('')
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null)
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({})

  // Load investigations
  const loadInvestigations = useCallback(async () => {
    try {
      const res = await fetch('/api/scout/investigations')
      if (res.ok) {
        const data = await res.json()
        setInvestigations(data.investigations || [])
      }
    } catch {
      // silent
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadInvestigations()
  }, [loadInvestigations])

  // Investigate
  const handleInvestigate = async () => {
    if (!companyName.trim()) {
      toast.error('Nome da empresa é obrigatório')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/scout/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          cnpj: cnpj.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro na investigação')
      }

      const data = await res.json()
      toast.success(`Investigação de "${companyName}" concluída!`)

      // Add to list and select
      const newInvestigation: Investigation = {
        ...data.investigation,
        portaScore: data.portaScore,
      }
      setInvestigations((prev) => [newInvestigation, ...prev])
      setSelectedInvestigation(newInvestigation)

      // Reset form
      setCompanyName('')
      setCnpj('')
      setSector('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na investigação')
    } finally {
      setIsLoading(false)
    }
  }

  // Delete investigation
  const deleteInvestigation = async (id: string) => {
    try {
      const res = await fetch(`/api/scout/investigations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setInvestigations((prev) => prev.filter((i) => i.id !== id))
        if (selectedInvestigation?.id === id) {
          setSelectedInvestigation(null)
        }
        toast.success('Investigação excluída')
      }
    } catch {
      toast.error('Erro ao excluir investigação')
    }
  }

  // View investigation detail
  const viewInvestigation = async (id: string) => {
    try {
      const res = await fetch(`/api/scout/investigations/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedInvestigation(data.investigation)
      }
    } catch {
      toast.error('Erro ao carregar detalhes')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <Search className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Scout</h2>
            <p className="text-xs text-muted-foreground">Investigação de Empresas</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 space-y-6">
          {/* Investigation Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Nova Investigação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name">Nome da Empresa *</Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Empresa X LTDA"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                  <Input
                    id="cnpj"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <Select value={sector} onValueChange={setSector} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
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
                <div className="flex items-end">
                  <Button
                    onClick={handleInvestigate}
                    disabled={isLoading || !companyName.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Investigando...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Investigar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Investigation Detail */}
          {selectedInvestigation && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {selectedInvestigation.companyName}
                  </CardTitle>
                  <Badge
                    className={STATUS_COLORS[selectedInvestigation.status] || ''}
                  >
                    {STATUS_LABELS[selectedInvestigation.status] || selectedInvestigation.status}
                  </Badge>
                </div>
                {selectedInvestigation.sector && (
                  <Badge variant="outline" className="w-fit text-xs mt-1">
                    {SECTOR_LABELS[selectedInvestigation.sector] || selectedInvestigation.sector}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                {selectedInvestigation.summary && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Resumo Executivo</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedInvestigation.summary}
                    </p>
                  </div>
                )}

                {/* PORTA Score */}
                {selectedInvestigation.portaScore && (
                  <PortaScoreDisplay score={selectedInvestigation.portaScore} />
                )}

                {/* Raw Data (collapsible) */}
                {selectedInvestigation.rawData && (
                  <Collapsible
                    open={expandedRaw[selectedInvestigation.id]}
                    onOpenChange={() =>
                      setExpandedRaw((prev) => ({
                        ...prev,
                        [selectedInvestigation.id]: !prev[selectedInvestigation.id],
                      }))
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        {expandedRaw[selectedInvestigation.id] ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        Dados brutos da investigação
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto max-h-64 overflow-y-auto">
                        {(() => {
                          try {
                            return JSON.stringify(
                              JSON.parse(selectedInvestigation.rawData),
                              null,
                              2
                            )
                          } catch {
                            return selectedInvestigation.rawData
                          }
                        })()}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          )}

          {/* Investigations List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Investigações Recentes</h3>
            {isLoadingList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : investigations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma investigação realizada ainda.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use o formulário acima para investigar empresas.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {investigations.map((inv) => (
                  <Card
                    key={inv.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedInvestigation?.id === inv.id
                        ? 'ring-2 ring-emerald-500'
                        : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {inv.companyName}
                          </p>
                          {inv.sector && (
                            <Badge variant="outline" className="text-[10px] mt-1">
                              {SECTOR_LABELS[inv.sector] || inv.sector}
                            </Badge>
                          )}
                        </div>
                        <Badge
                          className={`text-[10px] ${
                            STATUS_COLORS[inv.status] || ''
                          }`}
                        >
                          {STATUS_LABELS[inv.status] || inv.status}
                        </Badge>
                      </div>

                      {inv.portaScore && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">PORTA:</span>
                          <span
                            className={`text-sm font-bold ${
                              inv.portaScore.total >= 6
                                ? 'text-emerald-600'
                                : inv.portaScore.total >= 3
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {inv.portaScore.total.toFixed(1)}
                          </span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => viewInvestigation(inv.id)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700"
                            onClick={() => deleteInvestigation(inv.id)}
                          >
                            <Trash2 className="h-3 w-3" />
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
    </div>
  )
}
