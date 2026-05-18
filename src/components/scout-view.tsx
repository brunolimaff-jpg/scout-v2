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
import ReactMarkdown from 'react-markdown'
import {
  Search,
  Loader2,
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  Target,
  MessageSquareQuote,
  Shield,
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
  subSector?: string | null
  notes?: string | null
}

interface Evidence {
  type: 'fact' | 'hypotesis' | 'recommendation' | 'gap'
  claim: string
  source: string
  confidence: 'high' | 'medium' | 'low'
}

interface CommercialThesis {
  thesis?: string
  seniorModules?: string[]
  painPoints?: string[]
  decisionMakers?: string[]
  risks?: string[]
  nextSteps?: string[]
  smartQuestions?: string[]
}

interface Investigation {
  id: string
  companyName: string
  cnpj?: string | null
  sector?: string | null
  subSector?: string | null
  status: string
  summary?: string | null
  rawData?: string | null
  evidences?: string | null
  classification?: string | null
  commercialThesis?: string | null
  sources?: string | null
  qualityCheck?: string | null
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

const SUB_SECTOR_LABELS: Record<string, string> = {
  produtor_larga_escala: 'Produtor Larga Escala',
  cooperativa: 'Cooperativa',
  revenda_insumos: 'Revenda Insumos',
  cerealista: 'Cerealista/Armazenagem',
  trading: 'Trading',
  agroindustria: 'Agroindústria',
  pecuaria: 'Pecuária',
  usina: 'Usina',
  regenerativa: 'Regenerativa/Sustentável',
  mista: 'Mista/Complexa',
}

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

const EVIDENCE_STYLES: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  fact: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30', label: 'FATO' },
  hypotesis: { icon: HelpCircle, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30', label: 'HIPÓTESE' },
  hypothesis: { icon: HelpCircle, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30', label: 'HIPÓTESE' },
  recommendation: { icon: Lightbulb, color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30', label: 'RECOMENDAÇÃO' },
  gap: { icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30', label: 'LACUNA' },
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    evidences: true,
    thesis: false,
    sources: false,
    raw: false,
  })

  // Parse JSON fields safely
  const parseJson = <T,>(jsonStr: string | null | undefined, fallback: T): T => {
    if (!jsonStr) return fallback
    try { return JSON.parse(jsonStr) } catch { return fallback }
  }

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

      const newInvestigation: Investigation = {
        ...data.investigation,
        portaScore: data.portaScore,
      }
      setInvestigations((prev) => [newInvestigation, ...prev])
      setSelectedInvestigation(newInvestigation)
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

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Parsed data for selected investigation
  const evidenceList = parseJson<Evidence[]>(selectedInvestigation?.evidences, [])
  const classification = parseJson<Record<string, string>>(selectedInvestigation?.classification, {})
  const thesis = parseJson<CommercialThesis>(selectedInvestigation?.commercialThesis, {})
  const sourcesList = parseJson<Array<{ title: string; url: string; snippet: string; type: string }>>(selectedInvestigation?.sources, [])
  const qcResult = parseJson<{ passed: boolean; issues: string[] }>(selectedInvestigation?.qualityCheck, { passed: true, issues: [] })

  const facts = evidenceList.filter(e => e.type === 'fact')
  const hypotheses = evidenceList.filter(e => e.type === 'hypotesis' || e.type === 'hypothesis')
  const recommendations = evidenceList.filter(e => e.type === 'recommendation')
  const gaps = evidenceList.filter(e => e.type === 'gap')

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
            <p className="text-xs text-muted-foreground">Investigação Baseada em Evidências</p>
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
                    placeholder="Ex: Scheffer Agropecuária"
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
              <div className="flex items-end gap-4">
                <Button
                  onClick={handleInvestigate}
                  disabled={isLoading || !companyName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700"
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
                {isLoading && (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    Buscando fontes, extraindo fatos, classificando empresa, calculando score auditável...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Investigation Detail */}
          {selectedInvestigation && (
            <div className="space-y-4">
              {/* Header Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg">{selectedInvestigation.companyName}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLORS[selectedInvestigation.status] || ''}>
                        {STATUS_LABELS[selectedInvestigation.status] || selectedInvestigation.status}
                      </Badge>
                      {selectedInvestigation.sector && (
                        <Badge variant="outline" className="text-xs">
                          {SECTOR_LABELS[selectedInvestigation.sector] || selectedInvestigation.sector}
                        </Badge>
                      )}
                      {selectedInvestigation.subSector && (
                        <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400">
                          {SUB_SECTOR_LABELS[selectedInvestigation.subSector] || selectedInvestigation.subSector}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Classification badges */}
                  {classification && Object.keys(classification).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {classification.companyType && classification.companyType !== 'indefinido' && (
                        <Badge variant="secondary" className="text-[10px]">{classification.companyType}</Badge>
                      )}
                      {classification.scale && classification.scale !== 'indefinido_sem_evidencia' && (
                        <Badge variant="secondary" className="text-[10px]">Porte: {classification.scale}</Badge>
                      )}
                      {classification.complexity && classification.complexity !== 'indefinido_sem_evidencia' && (
                        <Badge variant="secondary" className="text-[10px]">Complexidade: {classification.complexity}</Badge>
                      )}
                    </div>
                  )}
                  {/* Quality check warning */}
                  {qcResult && !qcResult.passed && qcResult.issues.length > 0 && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
                      <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Verificação de qualidade: reescrita aplicada
                      </p>
                      {qcResult.issues.map((issue, i) => (
                        <p key={i} className="text-[10px] text-amber-600 dark:text-amber-500">• {issue}</p>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedInvestigation.summary && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{selectedInvestigation.summary}</ReactMarkdown>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* PORTA Score */}
              {selectedInvestigation.portaScore && (
                <PortaScoreDisplay score={selectedInvestigation.portaScore} />
              )}

              {/* Evidence List */}
              <Collapsible open={expandedSections.evidences} onOpenChange={() => toggleSection('evidences')}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-sm font-semibold w-full text-left py-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.evidences ? '' : '-rotate-90'}`} />
                    <Target className="h-4 w-4 text-emerald-600" />
                    Evidências ({evidenceList.length})
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      {facts.length} fatos · {hypotheses.length} hipóteses · {gaps.length} lacunas · {recommendations.length} recomendações
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-2">
                    {/* Facts */}
                    {facts.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> FATOS ({facts.length})
                        </p>
                        {facts.map((e, i) => (
                          <div key={i} className={`p-2.5 rounded-md text-sm ${EVIDENCE_STYLES.fact.color}`}>
                            <p className="font-medium">{e.claim}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Fonte: {e.source}</p>
                            <Badge className={`text-[9px] mt-1 ${CONFIDENCE_COLORS[e.confidence] || ''}`}>
                              Confiança: {e.confidence === 'high' ? 'Alta' : e.confidence === 'medium' ? 'Média' : 'Baixa'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Hypotheses */}
                    {hypotheses.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <HelpCircle className="h-3 w-3" /> HIPÓTESES ({hypotheses.length})
                        </p>
                        {hypotheses.map((e, i) => (
                          <div key={i} className={`p-2.5 rounded-md text-sm ${EVIDENCE_STYLES.hypotesis.color}`}>
                            <p className="font-medium">{e.claim}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Indício: {e.source}</p>
                            <Badge className={`text-[9px] mt-1 ${CONFIDENCE_COLORS[e.confidence] || ''}`}>
                              Confiança: {e.confidence === 'high' ? 'Alta' : e.confidence === 'medium' ? 'Média' : 'Baixa'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Gaps */}
                    {gaps.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> LACUNAS ({gaps.length})
                        </p>
                        {gaps.map((e, i) => (
                          <div key={i} className={`p-2.5 rounded-md text-sm ${EVIDENCE_STYLES.gap.color}`}>
                            <p>{e.claim}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommendations */}
                    {recommendations.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" /> RECOMENDAÇÕES ({recommendations.length})
                        </p>
                        {recommendations.map((e, i) => (
                          <div key={i} className={`p-2.5 rounded-md text-sm ${EVIDENCE_STYLES.recommendation.color}`}>
                            <p>{e.claim}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Commercial Thesis */}
              <Collapsible open={expandedSections.thesis} onOpenChange={() => toggleSection('thesis')}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-sm font-semibold w-full text-left py-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.thesis ? '' : '-rotate-90'}`} />
                    <Target className="h-4 w-4 text-teal-600" />
                    Tese Comercial
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 mt-2">
                    {thesis.thesis && (
                      <Card className="border-teal-200 dark:border-teal-800">
                        <CardContent className="p-3">
                          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">{thesis.thesis}</p>
                        </CardContent>
                      </Card>
                    )}

                    {thesis.seniorModules && thesis.seniorModules.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1.5">Módulos Senior Sugeridos</p>
                        <div className="flex flex-wrap gap-1.5">
                          {thesis.seniorModules.map((m, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {thesis.painPoints && thesis.painPoints.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1.5">Dores Prováveis</p>
                        <div className="space-y-1">
                          {thesis.painPoints.map((p, i) => (
                            <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                              {p}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {thesis.decisionMakers && thesis.decisionMakers.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1.5">Decisores Prováveis</p>
                        <div className="flex flex-wrap gap-1.5">
                          {thesis.decisionMakers.map((d, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{d}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {thesis.risks && thesis.risks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1.5">Riscos</p>
                        <div className="space-y-1">
                          {thesis.risks.map((r, i) => (
                            <p key={i} className="text-xs text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
                              <Shield className="h-3 w-3 flex-shrink-0 mt-0.5" />
                              {r}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {thesis.nextSteps && thesis.nextSteps.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1.5">Próximos Passos</p>
                        <div className="space-y-1">
                          {thesis.nextSteps.map((s, i) => (
                            <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-emerald-500 font-bold flex-shrink-0">{i + 1}.</span>
                              {s}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {thesis.smartQuestions && thesis.smartQuestions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1.5 flex items-center gap-1">
                          <MessageSquareQuote className="h-3 w-3" /> Perguntas Inteligentes para Reunião
                        </p>
                        <div className="space-y-1.5">
                          {thesis.smartQuestions.map((q, i) => (
                            <div key={i} className="p-2 rounded-md bg-muted/50 text-xs">
                              {q}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Sources */}
              <Collapsible open={expandedSections.sources} onOpenChange={() => toggleSection('sources')}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-sm font-semibold w-full text-left py-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.sources ? '' : '-rotate-90'}`} />
                    <ExternalLink className="h-4 w-4 text-slate-500" />
                    Fontes Consultadas ({sourcesList.length})
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1.5 mt-2 max-h-64 overflow-y-auto">
                    {sourcesList.map((s, i) => (
                      <div key={i} className="p-2 rounded-md bg-muted/30 text-xs space-y-0.5">
                        <p className="font-medium truncate">{s.title}</p>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate"
                        >
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{s.url}</span>
                        </a>
                        {s.snippet && <p className="text-muted-foreground line-clamp-2">{s.snippet}</p>}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Raw Data */}
              <Collapsible open={expandedSections.raw} onOpenChange={() => toggleSection('raw')}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground w-full text-left py-1">
                    <ChevronDown className={`h-3 w-3 transition-transform ${expandedSections.raw ? '' : '-rotate-90'}`} />
                    Dados brutos (JSON)
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="p-3 bg-muted rounded-md text-[10px] overflow-x-auto max-h-48 overflow-y-auto">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedInvestigation.rawData || '{}'), null, 2)
                      } catch {
                        return selectedInvestigation.rawData
                      }
                    })()}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </div>
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
                    Use o formulário acima para investigar empresas com base em evidências.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {investigations.map((inv) => (
                  <Card
                    key={inv.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedInvestigation?.id === inv.id ? 'ring-2 ring-emerald-500' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{inv.companyName}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {inv.sector && (
                              <Badge variant="outline" className="text-[10px]">
                                {SECTOR_LABELS[inv.sector] || inv.sector}
                              </Badge>
                            )}
                            {inv.subSector && (
                              <Badge variant="outline" className="text-[10px] text-emerald-600">
                                {SUB_SECTOR_LABELS[inv.subSector] || inv.subSector}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge className={`text-[10px] ${STATUS_COLORS[inv.status] || ''}`}>
                          {STATUS_LABELS[inv.status] || inv.status}
                        </Badge>
                      </div>

                      {inv.portaScore && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">PORTA:</span>
                          <span className={`text-sm font-bold ${
                            inv.portaScore.total >= 6 ? 'text-emerald-600' : inv.portaScore.total >= 3 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {inv.portaScore.total.toFixed(1)}
                          </span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => viewInvestigation(inv.id)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700" onClick={() => deleteInvestigation(inv.id)}>
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
