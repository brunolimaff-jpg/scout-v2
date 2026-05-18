'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  SearchLoadingIndicator,
  RADAR_STAGES,
  RADAR_EMPTY_STATES,
  EmptyState,
  useEstimatedProgress,
} from '@/components/investigation-loader'
import {
  Radar,
  Loader2,
  Search,
  ExternalLink,
  TrendingUp,
  Shield,
  Cpu,
  Lightbulb,
  Scale,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

// ---------- Types ----------

interface RadarEntry {
  id: string
  title: string
  category: string
  sector?: string | null
  summary: string
  source?: string | null
  sourceUrl?: string | null
  relevance: number
  createdAt: string
}

// ---------- Helpers ----------

const CATEGORY_OPTIONS = [
  { value: 'competitor', label: 'Competidor', icon: Shield },
  { value: 'market_trend', label: 'Tendência de Mercado', icon: TrendingUp },
  { value: 'regulation', label: 'Regulamentação', icon: Scale },
  { value: 'technology', label: 'Tecnologia', icon: Cpu },
  { value: 'opportunity', label: 'Oportunidade', icon: Lightbulb },
]

const SECTOR_OPTIONS = [
  { value: 'agro', label: 'Agro' },
  { value: 'construction', label: 'Construção' },
  { value: 'retail', label: 'Varejo' },
  { value: 'industry', label: 'Indústria' },
  { value: 'services', label: 'Serviços' },
  { value: 'logistics', label: 'Logística' },
]

const SECTOR_LABELS: Record<string, string> = Object.fromEntries(SECTOR_OPTIONS.map(s => [s.value, s.label]))

const CATEGORY_COLORS: Record<string, string> = {
  competitor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  market_trend: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  regulation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  technology: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  opportunity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map(c => [c.value, c.label]))

function getCategoryIcon(category: string) {
  const opt = CATEGORY_OPTIONS.find(c => c.value === category)
  return opt?.icon || Radar
}

// ---------- Component ----------

export function RadarView() {
  const [entries, setEntries] = useState<RadarEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sector, setSector] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // Loading progress
  const {
    stageStatuses,
    currentStageId,
    tickerItems,
    elapsedSeconds,
    isCancelling,
    completeAll,
    cancel: cancelProgress,
  } = useEstimatedProgress(RADAR_STAGES, isLoading, () => {})

  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/radar/entries')
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries || [])
      }
    } catch { /* */ } finally { setIsLoadingList(false) }
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Informe um termo de busca')
      return
    }

    setIsLoading(true)
    const abortController = new AbortController()
    abortRef.current = abortController

    // 45-second timeout for the API call
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, 45_000)

    try {
      const res = await fetch('/api/radar/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          category: category || undefined,
          sector: sector || undefined,
        }),
        signal: abortController.signal,
      })

      if (!res.ok) {
        let errorMsg = 'Erro na busca'
        try {
          const errorData = await res.json().catch(() => ({}))
          errorMsg = errorData.error || errorData.details || errorData.message || `Erro ${res.status}: ${res.statusText}`
        } catch { /* use default */ }
        throw new Error(errorMsg)
      }

      const data = await res.json()

      // Complete loading progress ONLY on success
      clearTimeout(timeoutId)
      completeAll()

      if (data.entries && data.entries.length > 0) {
        toast.success(`${data.entries.length} entrada(s) encontrada(s)!`)
        setEntries(prev => [...(data.entries || []), ...prev])
      } else {
        toast.info('Nenhum resultado encontrado')
      }

      setQuery('')
    } catch (err) {
      clearTimeout(timeoutId)
      // Stop the estimated progress on error
      cancelProgress()
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('Busca cancelada')
      } else {
        const msg = err instanceof Error ? err.message : 'Erro na busca'
        toast.error(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const cancelSearch = () => {
    if (abortRef.current) abortRef.current.abort()
    cancelProgress()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-teal-50/50 dark:bg-teal-950/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 dark:bg-teal-900/40 rounded-lg">
            <Radar className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Radar</h2>
            <p className="text-xs text-muted-foreground">Inteligência Competitiva</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 space-y-6">
          {/* Search Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                Busca de Inteligência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="radar-query">Consulta *</Label>
                <Input
                  id="radar-query"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Ex: Tendências de ERP cloud no Brasil"
                  disabled={isLoading}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={setCategory} disabled={isLoading}>
                    <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <Select value={sector} onValueChange={setSector} disabled={isLoading}>
                    <SelectTrigger><SelectValue placeholder="Todos os setores" /></SelectTrigger>
                    <SelectContent>
                      {SECTOR_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSearch} disabled={isLoading || !query.trim()} className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700">
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando...</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" />Buscar no Radar</>
                  )}
                </Button>
                {isLoading && (
                  <Button variant="ghost" size="sm" onClick={cancelSearch} disabled={isCancelling} className="text-rose-500 hover:text-rose-700">
                    <X className="h-4 w-4 mr-1" />
                    {isCancelling ? 'Cancelando...' : 'Cancelar'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Loading indicator */}
          {isLoading && (
            <SearchLoadingIndicator
              stages={RADAR_STAGES}
              stageStatuses={stageStatuses}
              currentStageId={currentStageId}
              tickerItems={tickerItems}
              elapsedSeconds={elapsedSeconds}
              onCancel={cancelSearch}
              isCancelling={isCancelling}
            />
          )}

          {/* Results */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Entradas do Radar ({entries.length})</h3>
            {isLoadingList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <EmptyState config={RADAR_EMPTY_STATES.no_alerts} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {entries.map(entry => {
                  const Icon = getCategoryIcon(entry.category)
                  return (
                    <Card key={entry.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <p className="font-medium text-sm leading-tight">{entry.title}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge className={`text-[10px] ${CATEGORY_COLORS[entry.category] || ''}`}>
                            {CATEGORY_LABELS[entry.category] || entry.category}
                          </Badge>
                          {entry.sector && <Badge variant="outline" className="text-[10px]">{SECTOR_LABELS[entry.sector] || entry.sector}</Badge>}
                          <Badge variant="secondary" className="text-[10px]">Relevância: {(entry.relevance * 10).toFixed(0)}%</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">{entry.summary}</p>
                        <div className="flex items-center justify-between">
                          {entry.sourceUrl ? (
                            <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5">
                              <ExternalLink className="h-2.5 w-2.5" />{entry.source || 'Fonte'}
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">{entry.source || 'Sem fonte'}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
