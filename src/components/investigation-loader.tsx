'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  XCircle,
  SkipForward,
  Search,
  BookOpen,
  Radar,
  X,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  FileQuestion,
  ShieldAlert,
  Database,
  ArrowRight,
  Zap,
  Eye,
} from 'lucide-react'

// ============================================================
// UNIQUE ID COUNTER
// ============================================================

let _tickerCounter = 0
function nextTickerId(prefix: string): string {
  return `${prefix}-${++_tickerCounter}`
}

// ============================================================
// TYPES
// ============================================================

export interface StageDef {
  id: string
  label: string
  description: string
  microcopy: string
}

export type StageStatus = 'pending' | 'active' | 'completed' | 'warning' | 'failed' | 'skipped'

export interface TickerItem {
  id: string
  message: string
  type: 'found' | 'warning' | 'info' | 'error'
  timestamp: number
}

export interface SourceStatusItem {
  name: string
  label: string
  status: 'consultando' | 'ok' | 'falhou' | 'cache' | 'ignorado'
}

export type ConfidenceLevel = 'baixa' | 'média' | 'alta'

export type LoaderVariant = 'scout' | 'warroom' | 'radar'

export interface InvestigationLoaderProps {
  stages: StageDef[]
  stageStatuses: Record<string, StageStatus>
  currentStageId: string | null
  tickerItems: TickerItem[]
  sourceStatuses: SourceStatusItem[]
  confidence: ConfidenceLevel | null
  elapsedSeconds: number
  onCancel: () => void
  isCancelling: boolean
  variant: LoaderVariant
  companyName?: string
  errorState?: ErrorState | null
}

export interface ErrorState {
  type: 'no_internet' | 'api_slow' | 'api_down' | 'cnpj_not_found' | 'company_ambiguous' |
        'sector_uncertain' | 'docs_not_found' | 'no_reliable_source' |
        'timeout' | 'cancelled' | 'insufficient_evidence' | 'unknown'
  message: string
  action?: { label: string; handler: () => void }
}

// ============================================================
// STAGE DEFINITIONS
// ============================================================

export const SCOUT_STAGES: StageDef[] = [
  { id: 'preparing', label: 'Preparando investigação', description: 'Planejando consultas e extraindo parâmetros', microcopy: 'Consultando fontes oficiais...' },
  { id: 'cadastre', label: 'Consultando dados cadastrais', description: 'Buscando CNPJ na BrasilAPI e fontes públicas', microcopy: 'Buscando CNPJ em fonte pública...' },
  { id: 'enriching', label: 'Pesquisando fontes', description: 'Consultando múltiplas fontes de informação', microcopy: 'Tentando fonte alternativa...' },
  { id: 'sector_detection', label: 'Detectando setor', description: 'Cruzando evidências para classificar', microcopy: 'Validando dados encontrados...' },
  { id: 'playbook', label: 'Selecionando playbook', description: 'Escolhendo lente setorial adequada', microcopy: 'Cruzando informações antes de responder...' },
  { id: 'evidence', label: 'Extraindo evidências', description: 'Separando fatos, hipóteses e lacunas', microcopy: 'Verificando consistência das fontes...' },
  { id: 'competition', label: 'Mapeando concorrência', description: 'Buscando sinais competitivos reais', microcopy: 'Reconsultando com outro provedor...' },
  { id: 'porta', label: 'Avaliando PORTA', description: 'Calculando score com evidências por dimensão', microcopy: 'Buscando evidências suficientes para uma resposta segura...' },
  { id: 'thesis', label: 'Montando tese comercial', description: 'Gerando análise baseada em evidências', microcopy: 'Construindo análise fundamentada...' },
  { id: 'validating', label: 'Validando resultado', description: 'Verificando qualidade e consistência', microcopy: 'Verificando consistência das fontes...' },
  { id: 'saving', label: 'Salvando histórico', description: 'Persistindo dossiê e score', microcopy: 'Salvando o dossiê final...' },
]

export const WARROOM_STAGES: StageDef[] = [
  { id: 'understanding', label: 'Entendendo dúvida', description: 'Analisando sua pergunta', microcopy: 'Compreendendo o que você precisa...' },
  { id: 'identifying', label: 'Identificando contexto', description: 'Produto, módulo, tela, erro ou processo', microcopy: 'Identificando o contexto da sua dúvida...' },
  { id: 'searching', label: 'Buscando na documentação Senior', description: 'Consultando documentacao.senior.com.br', microcopy: 'Pesquisando na base de documentação...' },
  { id: 'reading', label: 'Lendo páginas relevantes', description: 'Extraindo conteúdo das páginas', microcopy: 'Lendo e analisando as páginas encontradas...' },
  { id: 'comparing', label: 'Comparando trechos', description: 'Cruzando informações de múltiplas fontes', microcopy: 'Cruzando informações de diferentes páginas...' },
  { id: 'composing', label: 'Montando resposta com links', description: 'Sintetizando a resposta', microcopy: 'Sintetizando a resposta com referências...' },
  { id: 'verifying', label: 'Verificando confiança', description: 'Avaliando qualidade e completude', microcopy: 'Verificando a qualidade da resposta...' },
  { id: 'referencing', label: 'Exibindo referências oficiais', description: 'Preparando links e fontes', microcopy: 'Preparando as referências oficiais...' },
]

export const RADAR_STAGES: StageDef[] = [
  { id: 'selecting', label: 'Selecionando alvo', description: 'Empresa, setor ou região', microcopy: 'Definindo o escopo da busca...' },
  { id: 'scanning', label: 'Buscando sinais recentes', description: 'Pesquisando novidades e movimentos', microcopy: 'Escaneando sinais de mercado...' },
  { id: 'classifying', label: 'Classificando alertas', description: 'Categorizando achados', microcopy: 'Classificando os sinais encontrados...' },
  { id: 'evaluating', label: 'Avaliando impacto comercial', description: 'Medindo relevância para Senior', microcopy: 'Avaliando o impacto comercial...' },
  { id: 'prioritizing', label: 'Priorizando severidade', description: 'Ordenando por urgência', microcopy: 'Priorizando por severidade e relevância...' },
  { id: 'saving_radar', label: 'Salvando alertas', description: 'Persistindo no radar', microcopy: 'Salvando os alertas no radar...' },
  { id: 'suggesting', label: 'Gerando próximos movimentos', description: 'Sugerindo ações', microcopy: 'Gerando recomendações de ação...' },
]

// ============================================================
// PROGRESSIVE DELAY MESSAGES
// ============================================================

const PROGRESSIVE_MESSAGES = [
  { threshold: 8, message: 'Consultando fontes oficiais... a investigação é detalhada.' },
  { threshold: 15, message: 'Algumas fontes estão demorando. Tentando fonte alternativa...' },
  { threshold: 25, message: 'Validando dados encontrados. Aguardando resposta da fonte...' },
  { threshold: 40, message: 'Cruzando evidências antes de responder. Buscando confirmação...' },
  { threshold: 60, message: 'A investigação está levando mais tempo que o esperado. Verificando consistência das fontes...' },
]

export function getProgressiveMessage(elapsedSeconds: number): string | null {
  for (let i = PROGRESSIVE_MESSAGES.length - 1; i >= 0; i--) {
    if (elapsedSeconds >= PROGRESSIVE_MESSAGES[i].threshold) {
      return PROGRESSIVE_MESSAGES[i].message
    }
  }
  return null
}

// ============================================================
// VARIANT THEME
// ============================================================

const VARIANT_THEMES: Record<LoaderVariant, {
  accent: string
  accentBg: string
  accentText: string
  icon: React.ElementType
  gradientFrom: string
}> = {
  scout: {
    accent: 'emerald',
    accentBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    icon: Search,
    gradientFrom: 'from-emerald-50 dark:from-emerald-950/20',
  },
  warroom: {
    accent: 'emerald',
    accentBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    icon: BookOpen,
    gradientFrom: 'from-emerald-50 dark:from-emerald-950/20',
  },
  radar: {
    accent: 'teal',
    accentBg: 'bg-teal-100 dark:bg-teal-900/30',
    accentText: 'text-teal-600 dark:text-teal-400',
    icon: Radar,
    gradientFrom: 'from-teal-50 dark:from-teal-950/20',
  },
}

// ============================================================
// LOADING TIMELINE
// ============================================================

const STAGE_ICONS: Record<StageStatus, React.ElementType> = {
  pending: Circle,
  active: Loader2,
  completed: CheckCircle2,
  warning: AlertTriangle,
  failed: XCircle,
  skipped: SkipForward,
}

const STAGE_COLORS: Record<StageStatus, string> = {
  pending: 'text-muted-foreground/40',
  active: 'text-emerald-500 animate-spin',
  completed: 'text-emerald-500',
  warning: 'text-amber-500',
  failed: 'text-rose-500',
  skipped: 'text-muted-foreground/60',
}

const CONNECTOR_COLORS: Record<StageStatus, string> = {
  pending: 'bg-muted-foreground/20',
  active: 'bg-emerald-400',
  completed: 'bg-emerald-400',
  warning: 'bg-amber-400',
  failed: 'bg-rose-400',
  skipped: 'bg-muted-foreground/30',
}

function LoadingTimeline({
  stages,
  stageStatuses,
  currentStageId,
}: {
  stages: StageDef[]
  stageStatuses: Record<string, StageStatus>
  currentStageId: string | null
}) {
  const currentIdx = stages.findIndex(s => s.id === currentStageId)

  return (
    <div className="space-y-0">
      {stages.map((stage, idx) => {
        const status = stageStatuses[stage.id] || 'pending'
        const Icon = STAGE_ICONS[status]
        const isCurrent = stage.id === currentStageId
        const connectorStatus = idx < currentIdx ? 'completed' : idx === currentIdx ? 'active' : 'pending'

        return (
          <div key={stage.id} className="relative">
            {/* Connector line */}
            {idx > 0 && (
              <div
                className={`absolute left-[11px] top-0 w-0.5 h-3 -translate-y-0.5 transition-colors duration-300 ${CONNECTOR_COLORS[connectorStatus]}`}
              />
            )}
            <div className={`flex items-start gap-3 py-1.5 transition-all duration-300 ${isCurrent ? 'opacity-100' : status === 'pending' ? 'opacity-40' : 'opacity-70'}`}>
              <div className="flex-shrink-0 mt-0.5">
                <Icon className={`h-[22px] w-[22px] ${STAGE_COLORS[status]}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-tight ${
                  isCurrent ? 'text-foreground' : status === 'completed' ? 'text-muted-foreground' : 'text-muted-foreground/70'
                }`}>
                  {stage.label}
                </p>
                {isCurrent && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    {stage.microcopy}
                  </p>
                )}
              </div>
              {status === 'completed' && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// EVIDENCE TICKER
// ============================================================

const TICKER_ICONS: Record<string, React.ElementType> = {
  found: Zap,
  warning: AlertTriangle,
  info: Eye,
  error: XCircle,
}

const TICKER_COLORS: Record<string, string> = {
  found: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
  warning: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
  info: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30',
  error: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30',
}

function EvidenceTicker({ items }: { items: TickerItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [items.length])

  if (items.length === 0) return null

  // Deduplicate items by ID, keeping only the first occurrence
  const seen = new Set<string>()
  const deduped = items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })

  return (
    <div ref={scrollRef} className="max-h-28 overflow-y-auto space-y-1 scrollbar-thin">
      {deduped.map((item) => {
        const Icon = TICKER_ICONS[item.type] || Eye
        return (
          <div
            key={item.id}
            className={`flex items-start gap-1.5 px-2 py-1 rounded text-[11px] leading-tight ${TICKER_COLORS[item.type] || TICKER_COLORS.info} animate-in fade-in slide-in-from-bottom-1 duration-300`}
          >
            <Icon className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{item.message}</span>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// SOURCE STATUS
// ============================================================

const SOURCE_STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  consultando: { icon: Loader2, color: 'text-emerald-500', label: 'Consultando' },
  ok: { icon: CheckCircle2, color: 'text-emerald-500', label: 'OK' },
  falhou: { icon: XCircle, color: 'text-rose-500', label: 'Falhou' },
  cache: { icon: Database, color: 'text-amber-500', label: 'Cache' },
  ignorado: { icon: SkipForward, color: 'text-muted-foreground/50', label: 'Ignorado' },
}

function SourceStatusBar({ sources }: { sources: SourceStatusItem[] }) {
  if (sources.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => {
        const config = SOURCE_STATUS_CONFIG[source.status] || SOURCE_STATUS_CONFIG.ignorado
        const Icon = config.icon
        return (
          <div
            key={source.name}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 text-[10px]"
          >
            <Icon className={`h-3 w-3 ${config.color} ${source.status === 'consultando' ? 'animate-spin' : ''}`} />
            <span className="text-muted-foreground">{source.label}</span>
            <span className={`font-medium ${config.color}`}>{config.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// CONFIDENCE INDICATOR
// ============================================================

const CONFIDENCE_CONFIG: Record<string, { color: string; bgColor: string; width: string; label: string }> = {
  baixa: { color: 'text-rose-600', bgColor: 'bg-rose-500', width: 'w-1/3', label: 'Baixa' },
  média: { color: 'text-amber-600', bgColor: 'bg-amber-500', width: 'w-2/3', label: 'Média' },
  alta: { color: 'text-emerald-600', bgColor: 'bg-emerald-500', width: 'w-full', label: 'Alta' },
}

function ConfidenceIndicator({ confidence }: { confidence: ConfidenceLevel | null }) {
  if (!confidence) return null
  const config = CONFIDENCE_CONFIG[confidence]

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground">Confiança:</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[80px]">
        <div className={`h-full rounded-full transition-all duration-500 ${config.bgColor} ${config.width}`} />
      </div>
      <span className={`text-[10px] font-medium ${config.color}`}>{config.label}</span>
    </div>
  )
}

// ============================================================
// ELAPSED TIME
// ============================================================

function ElapsedTime({ seconds }: { seconds: number }) {
  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`
    const min = Math.floor(s / 60)
    const sec = s % 60
    return `${min}m ${sec}s`
  }

  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>Investigando há {formatTime(seconds)}</span>
    </div>
  )
}

// ============================================================
// PROGRESSIVE DELAY MESSAGE
// ============================================================

function DelayMessage({ elapsedSeconds }: { elapsedSeconds: number }) {
  const msg = getProgressiveMessage(elapsedSeconds)
  if (!msg) return null

  return (
    <div className="flex items-start gap-1.5 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 animate-in fade-in duration-500">
      <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-tight">{msg}</p>
    </div>
  )
}

// ============================================================
// SKELETONS
// ============================================================

export function DossierSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function PortaScoreSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      {[0.1, 0.25, 0.1, 0.3, 0.25].map((w, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <Skeleton className={`h-full rounded-full ${i === 0 ? 'w-1/4' : i === 1 ? 'w-1/2' : i === 2 ? 'w-1/5' : i === 3 ? 'w-3/5' : 'w-1/2'}`} style={{ width: `${w * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RadarSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function SourcesSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-2 animate-pulse">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 flex-1" />
        </div>
      ))}
    </div>
  )
}

// ============================================================
// ERROR STATES
// ============================================================

const ERROR_STATE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  no_internet: { icon: WifiOff, color: 'text-rose-500' },
  api_slow: { icon: Clock, color: 'text-amber-500' },
  api_down: { icon: WifiOff, color: 'text-rose-500' },
  cnpj_not_found: { icon: Search, color: 'text-amber-500' },
  company_ambiguous: { icon: FileQuestion, color: 'text-amber-500' },
  sector_uncertain: { icon: FileQuestion, color: 'text-amber-500' },
  docs_not_found: { icon: BookOpen, color: 'text-amber-500' },
  no_reliable_source: { icon: ShieldAlert, color: 'text-rose-500' },
  insufficient_evidence: { icon: ShieldAlert, color: 'text-amber-500' },
  timeout: { icon: Clock, color: 'text-rose-500' },
  cancelled: { icon: X, color: 'text-slate-500' },
  unknown: { icon: AlertTriangle, color: 'text-rose-500' },
}

export function ErrorStateDisplay({ error, onRetry }: { error: ErrorState; onRetry?: () => void }) {
  const config = ERROR_STATE_CONFIG[error.type] || ERROR_STATE_CONFIG.unknown
  const Icon = config.icon

  return (
    <Card className="border-amber-200 dark:border-amber-800/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {error.message}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {error.action && (
            <Button variant="outline" size="sm" onClick={error.action.handler} className="text-xs">
              {error.action.label}
            </Button>
          )}
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              Tentar novamente
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// EMPTY STATES
// ============================================================

interface EmptyStateConfig {
  icon: React.ElementType
  title: string
  description: string
  action?: { label: string; handler: () => void }
}

export function EmptyState({ config }: { config: EmptyStateConfig }) {
  const Icon = config.icon
  return (
    <Card>
      <CardContent className="py-8 text-center space-y-2">
        <Icon className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">{config.title}</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">{config.description}</p>
        {config.action && (
          <Button variant="outline" size="sm" onClick={config.action.handler} className="mt-2 text-xs">
            {config.action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export const SCOUT_EMPTY_STATES: Record<string, EmptyStateConfig> = {
  no_investigations: {
    icon: Search,
    title: 'Nenhuma investigação realizada',
    description: 'Use o formulário acima para investigar empresas com base em evidências.',
  },
  cnpj_not_found: {
    icon: Search,
    title: 'CNPJ não encontrado',
    description: 'Verifique o CNPJ informado ou tente buscar apenas pelo nome da empresa.',
    action: { label: 'Buscar por nome', handler: () => {} },
  },
  company_ambiguous: {
    icon: FileQuestion,
    title: 'Empresa ambígua',
    description: 'Encontrei múltiplas empresas com esse nome. Informe o CNPJ para refinar.',
    action: { label: 'Informar CNPJ', handler: () => {} },
  },
  sector_uncertain: {
    icon: FileQuestion,
    title: 'Setor incerto',
    description: 'Não foi possível determinar o setor com confiança. Selecione manualmente.',
  },
  no_results: {
    icon: Search,
    title: 'Nenhum resultado encontrado',
    description: 'A investigação não encontrou dados suficientes. Tente outro nome ou CNPJ.',
  },
}

export const WARROOM_EMPTY_STATES: Record<string, EmptyStateConfig> = {
  no_docs_found: {
    icon: BookOpen,
    title: 'Documentação não encontrada',
    description: 'Não encontramos documentação relevante. Tente reformular a pergunta com termos mais específicos.',
  },
  unrelated: {
    icon: FileQuestion,
    title: 'Fora do escopo',
    description: 'Essa pergunta parece não estar relacionada à documentação Senior. Tente perguntar sobre produtos, módulos ou processos Senior.',
  },
}

export const RADAR_EMPTY_STATES: Record<string, EmptyStateConfig> = {
  no_alerts: {
    icon: Radar,
    title: 'Nenhuma entrada no radar',
    description: 'Use a busca acima para descobrir inteligência competitiva.',
  },
  no_results: {
    icon: Search,
    title: 'Nenhum sinal encontrado',
    description: 'Tente termos mais amplos ou outro setor.',
  },
}

// ============================================================
// MAIN INVESTIGATION LOADER
// ============================================================

export function InvestigationLoader({
  stages,
  stageStatuses,
  currentStageId,
  tickerItems,
  sourceStatuses,
  confidence,
  elapsedSeconds,
  onCancel,
  isCancelling,
  variant,
  companyName,
  errorState,
}: InvestigationLoaderProps) {
  const theme = VARIANT_THEMES[variant]
  const ThemeIcon = theme.icon
  const currentStage = stages.find(s => s.id === currentStageId)
  const completedCount = Object.values(stageStatuses).filter(s => s === 'completed').length
  const progress = stages.length > 0 ? (completedCount / stages.length) * 100 : 0

  return (
    <div className={`rounded-xl border bg-gradient-to-b ${theme.gradientFrom} to-background overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-background/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${theme.accentBg}`}>
              <ThemeIcon className={`h-4 w-4 ${theme.accentText}`} />
            </div>
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                {variant === 'scout' && `Investigando${companyName ? ` ${companyName}` : ''}`}
                {variant === 'warroom' && 'Consultando documentação Senior'}
                {variant === 'radar' && 'Escaneando radar'}
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </p>
              {currentStage && (
                <p className="text-[11px] text-muted-foreground">{currentStage.microcopy}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ElapsedTime seconds={elapsedSeconds} />
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isCancelling}
              className="h-7 text-xs text-muted-foreground hover:text-rose-600"
            >
              {isCancelling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              <span className="ml-1 hidden sm:inline">{isCancelling ? 'Cancelando...' : 'Cancelar'}</span>
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${theme.accentBg.replace('bg-', 'bg-').replace('/30', '').replace('dark:bg-', '')}`}
            style={{ width: `${Math.max(5, progress)}%` }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Error state */}
        {errorState && (
          <ErrorStateDisplay error={errorState} />
        )}

        {/* Progressive delay message */}
        <DelayMessage elapsedSeconds={elapsedSeconds} />

        {/* Main content: Timeline + Ticker */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {/* Timeline - takes 3 cols on sm+ */}
          <div className="sm:col-span-3">
            <LoadingTimeline
              stages={stages}
              stageStatuses={stageStatuses}
              currentStageId={currentStageId}
            />
          </div>

          {/* Right panel - Ticker + Confidence + Sources */}
          <div className="sm:col-span-2 space-y-3">
            {/* Evidence Ticker */}
            {tickerItems.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Achados em tempo real
                </p>
                <EvidenceTicker items={tickerItems} />
              </div>
            )}

            {/* Source Status */}
            {sourceStatuses.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Fontes</p>
                <SourceStatusBar sources={sourceStatuses} />
              </div>
            )}

            {/* Confidence */}
            {confidence && (
              <ConfidenceIndicator confidence={confidence} />
            )}
          </div>
        </div>

        {/* Result skeleton preview */}
        {progress > 40 && variant === 'scout' && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-[10px] font-medium text-muted-foreground">Prévia do dossiê</p>
            {progress < 70 ? (
              <DossierSkeleton />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PortaScoreSkeleton />
                <SourcesSkeleton />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// CHAT-STYLE LOADING INDICATOR (for War Room)
// ============================================================

export function ChatLoadingIndicator({
  stages,
  stageStatuses,
  currentStageId,
  tickerItems,
  elapsedSeconds,
  onCancel,
  isCancelling,
}: {
  stages: StageDef[]
  stageStatuses: Record<string, StageStatus>
  currentStageId: string | null
  tickerItems: TickerItem[]
  elapsedSeconds: number
  onCancel: () => void
  isCancelling: boolean
}) {
  const currentStage = stages.find(s => s.id === currentStageId)
  const completedCount = Object.values(stageStatuses).filter(s => s === 'completed').length
  const progress = stages.length > 0 ? (completedCount / stages.length) * 100 : 0

  return (
    <div className="bg-muted rounded-2xl px-4 py-3 space-y-2.5 max-w-[85%]">
      {/* Current stage */}
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
        <span className="text-sm text-muted-foreground">
          {currentStage ? currentStage.label : 'Processando...'}
        </span>
      </div>

      {/* Microcopy */}
      {currentStage && (
        <p className="text-xs text-muted-foreground/80 pl-6">{currentStage.microcopy}</p>
      )}

      {/* Mini timeline */}
      <div className="flex items-center gap-1 pl-6">
        {stages.map((stage) => {
          const status = stageStatuses[stage.id] || 'pending'
          return (
            <div
              key={stage.id}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                status === 'completed' ? 'bg-emerald-400' :
                status === 'active' ? 'bg-emerald-400 animate-pulse' :
                status === 'warning' ? 'bg-amber-400' :
                status === 'failed' ? 'bg-rose-400' :
                'bg-muted-foreground/20'
              }`}
              title={stage.label}
            />
          )
        })}
      </div>

      {/* Ticker items (last 3) */}
      {tickerItems.length > 0 && (
        <div className="pl-6 space-y-0.5">
          {tickerItems.slice(-3).map((item) => (
            <p key={item.id} className="text-[10px] text-muted-foreground/70 flex items-center gap-1 animate-in fade-in duration-300">
              {item.type === 'found' && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />}
              {item.type === 'warning' && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
              {item.type === 'info' && <Eye className="h-2.5 w-2.5 text-slate-400" />}
              {item.type === 'error' && <XCircle className="h-2.5 w-2.5 text-rose-500" />}
              {item.message}
            </p>
          ))}
        </div>
      )}

      {/* Delay message */}
      {getProgressiveMessage(elapsedSeconds) && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 pl-6">
          {getProgressiveMessage(elapsedSeconds)}
        </p>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between pl-6">
        <ElapsedTime seconds={elapsedSeconds} />
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isCancelling}
          className="h-5 text-[10px] text-muted-foreground hover:text-rose-600 px-1"
        >
          {isCancelling ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
          <span className="ml-0.5">{isCancelling ? 'Cancelando...' : 'Cancelar'}</span>
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// CARD-STYLE LOADING INDICATOR (for Radar)
// ============================================================

export function SearchLoadingIndicator({
  stages,
  stageStatuses,
  currentStageId,
  tickerItems,
  elapsedSeconds,
  onCancel,
  isCancelling,
}: {
  stages: StageDef[]
  stageStatuses: Record<string, StageStatus>
  currentStageId: string | null
  tickerItems: TickerItem[]
  elapsedSeconds: number
  onCancel: () => void
  isCancelling: boolean
}) {
  const currentStage = stages.find(s => s.id === currentStageId)
  const completedCount = Object.values(stageStatuses).filter(s => s === 'completed').length
  const progress = stages.length > 0 ? (completedCount / stages.length) * 100 : 0

  return (
    <Card className="border-teal-200 dark:border-teal-800/50">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
            <span className="text-sm font-medium">
              {currentStage ? currentStage.label : 'Escaneando...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ElapsedTime seconds={elapsedSeconds} />
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isCancelling}
              className="h-6 text-[10px] text-muted-foreground hover:text-rose-600 px-1.5"
            >
              {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-500 transition-all duration-700 ease-out"
            style={{ width: `${Math.max(5, progress)}%` }}
          />
        </div>

        {/* Mini timeline dots */}
        <div className="flex items-center gap-1.5">
          {stages.map((stage) => {
            const status = stageStatuses[stage.id] || 'pending'
            return (
              <div key={stage.id} className="flex items-center gap-1">
                <div
                  className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    status === 'completed' ? 'bg-teal-500' :
                    status === 'active' ? 'bg-teal-400 ring-2 ring-teal-200 dark:ring-teal-800' :
                    status === 'warning' ? 'bg-amber-500' :
                    status === 'failed' ? 'bg-rose-500' :
                    'bg-muted-foreground/20'
                  }`}
                  title={stage.label}
                />
                {status === 'active' && (
                  <span className="text-[9px] text-teal-600 dark:text-teal-400 font-medium whitespace-nowrap">
                    {stage.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Ticker */}
        {tickerItems.length > 0 && (
          <div className="space-y-0.5 max-h-16 overflow-y-auto">
            {tickerItems.slice(-4).map((item) => (
              <p key={item.id} className="text-[10px] text-muted-foreground flex items-center gap-1">
                {item.type === 'found' && <Zap className="h-2.5 w-2.5 text-teal-500" />}
                {item.type === 'warning' && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
                {item.type === 'info' && <Eye className="h-2.5 w-2.5 text-slate-400" />}
                {item.message}
              </p>
            ))}
          </div>
        )}

        {/* Delay message */}
        {getProgressiveMessage(elapsedSeconds) && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            {getProgressiveMessage(elapsedSeconds)}
          </p>
        )}

        {/* Skeleton preview */}
        {progress > 50 && <RadarSkeleton />}
      </CardContent>
    </Card>
  )
}

// ============================================================
// PORTA SCORE LOADING (dimension-by-dimension reveal)
// ============================================================

const PORTA_DIMENSIONS = [
  { key: 'porte', letter: 'P', name: 'Porte', weight: 0.10 },
  { key: 'operacao', letter: 'O', name: 'Operação', weight: 0.25 },
  { key: 'retorno', letter: 'R', name: 'Retorno', weight: 0.10 },
  { key: 'tecnologia', letter: 'T', name: 'Tecnologia', weight: 0.30 },
  { key: 'adocao', letter: 'A', name: 'Adoção', weight: 0.25 },
]

export function PortaScoreLoading({
  completedDimensions,
}: {
  completedDimensions: Record<string, { score: number; confidence: string }>
}) {
  const currentDimIdx = Object.keys(completedDimensions).length

  return (
    <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-0">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Score PORTA</p>
            <p className="text-2xl font-bold text-muted-foreground/50">—</p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Calculando...
          </Badge>
        </div>

        <div className="space-y-2.5">
          {PORTA_DIMENSIONS.map((dim, idx) => {
            const dimData = completedDimensions[dim.key]
            const isCompleted = !!dimData
            const isActive = idx === currentDimIdx && !isCompleted

            return (
              <div key={dim.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className={`font-bold ${isCompleted ? 'text-emerald-600' : isActive ? 'text-amber-600' : 'text-muted-foreground/40'}`}>
                      {dim.letter}
                    </span>
                    <span className={`text-muted-foreground ${!isCompleted && !isActive ? 'opacity-40' : ''}`}>
                      {dim.name}
                    </span>
                    {isActive && (
                      <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                    )}
                    {isCompleted && (
                      <Badge className={`text-[8px] px-1 py-0 ${
                        dimData.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                        dimData.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {dimData.confidence === 'high' ? 'Alta' : dimData.confidence === 'medium' ? 'Média' : 'Baixa'}
                      </Badge>
                    )}
                  </span>
                  <span className={`font-semibold ${isCompleted ? 'text-emerald-600' : 'text-muted-foreground/30'}`}>
                    {isCompleted ? dimData.score.toFixed(1) : '—'}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isCompleted ? 'bg-emerald-500' : isActive ? 'bg-amber-400 animate-pulse' : 'bg-muted-foreground/10'
                    }`}
                    style={{ width: isCompleted ? `${dimData.score * 10}%` : isActive ? '30%' : '0%' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// HOOKS
// ============================================================

// Hook for estimated progress (used by War Room and Radar)
export function useEstimatedProgress(stages: StageDef[], isActive: boolean, _onComplete: () => void) {
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>({})
  const [currentStageId, setCurrentStageId] = useState<string | null>(null)
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null)
  const currentIdxRef = useRef(0)
  const isActiveRef = useRef(isActive)

  // Sync ref inside effect
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  // Cleanup timers helper
  const clearTimers = (React.useCallback || useCallback)(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (stageTimerRef.current) { clearTimeout(stageTimerRef.current); stageTimerRef.current = null }
  }, [])

  // Main progress effect - starts when isActive becomes true
  useEffect(() => {
    if (!isActive) return

    // Reset state at start of new loading session (deferred to avoid synchronous setState in effect)
    currentIdxRef.current = 0
    const resetAndStart = () => {
      setStageStatuses({})
      setCurrentStageId(null)
      setTickerItems([])
      setElapsedSeconds(0)
      setIsCancelling(false)

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)

      // Start advancing through stages
      advanceStage(0)
    }

    // Start advancing through stages
    const advanceStage = (idx: number) => {
      if (!isActiveRef.current || idx >= stages.length) return

      const stage = stages[idx]
      currentIdxRef.current = idx

      setStageStatuses(prev => ({ ...prev, [stage.id]: 'active' }))
      setCurrentStageId(stage.id)
      setTickerItems(prev => [...prev, {
        id: nextTickerId(`ticker-${stage.id}`),
        message: stage.microcopy,
        type: 'info',
        timestamp: Date.now(),
      }])

      const stageDuration = idx < 2 ? 1500 : idx < 5 ? 2500 : 1500

      stageTimerRef.current = setTimeout(() => {
        setStageStatuses(prev => ({ ...prev, [stage.id]: 'completed' }))
        setTickerItems(prev => [...prev, {
          id: nextTickerId(`ticker-${stage.id}-done`),
          message: `${stage.label} ✓`,
          type: 'found',
          timestamp: Date.now(),
        }])

        if (idx + 1 < stages.length) {
          advanceStage(idx + 1)
        }
      }, stageDuration)
    }

    // Use setTimeout to make setState calls asynchronous (satisfies lint rule)
    const startTimer = setTimeout(resetAndStart, 0)

    return () => {
      clearTimeout(startTimer)
      clearTimers()
    }
  }, [isActive])

  const completeAll = (React.useCallback || useCallback)(() => {
    clearTimers()
    setStageStatuses(prev => {
      const updated = { ...prev }
      stages.forEach(stage => {
        if (updated[stage.id] !== 'completed') updated[stage.id] = 'completed'
      })
      return updated
    })
  }, [stages, clearTimers])

  const cancel = (React.useCallback || useCallback)(() => {
    setIsCancelling(true)
    clearTimers()
  }, [clearTimers])

  return {
    stageStatuses,
    currentStageId,
    tickerItems,
    elapsedSeconds,
    isCancelling,
    completeAll,
    cancel,
  }
}

// Hook for SSE-based progress (used by Scout)
export interface SSEProgressEvent {
  type: string
  stageId?: string
  label?: string
  message?: string
  timestamp?: string
  source?: string
  severity?: 'info' | 'warning' | 'error'
  confidence?: number
  metadata?: Record<string, unknown>
}

export function useSSEInvestigation() {
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>({})
  const [currentStageId, setCurrentStageId] = useState<string | null>(null)
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([])
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatusItem[]>([])
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  const [isActive, setIsActive] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startInvestigation = async (companyName: string, cnpj?: string) => {
    // Reset state
    setStageStatuses({})
    setCurrentStageId(null)
    setTickerItems([])
    setSourceStatuses([])
    setConfidence(null)
    setElapsedSeconds(0)
    setIsCancelling(false)
    setResult(null)
    setError(null)
    setIsActive(true)

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const response = await fetch('/api/scout/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, cnpj: cnpj || undefined }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro na investigação')
      }

      // Check if response is SSE stream
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/event-stream')) {
        // Parse SSE stream
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const dataStr = line.slice(6).trim()
            if (!dataStr) continue

            try {
              const event: SSEProgressEvent = JSON.parse(dataStr)
              handleSSEEvent(event)
            } catch {
              // Skip malformed events
            }
          }
        }

        // Process remaining buffer
        if (buffer.startsWith('data: ')) {
          try {
            const event: SSEProgressEvent = JSON.parse(buffer.slice(6).trim())
            handleSSEEvent(event)
          } catch {
            // Skip
          }
        }
      } else {
        // Legacy JSON response - extract result directly
        const data = await response.json()
        setResult(data)
        setIsActive(false)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError({
          type: 'cancelled',
          message: 'Investigação cancelada pelo usuário.',
          action: { label: 'Ver dados parciais', handler: () => {} },
        })
      } else {
        setError({
          type: 'unknown',
          message: err instanceof Error ? err.message : 'Erro na investigação',
          action: { label: 'Tentar novamente', handler: () => {} },
        })
      }
      setIsActive(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const handleSSEEvent = (event: SSEProgressEvent) => {
    switch (event.type) {
      case 'progress_stage_started':
        setStageStatuses(prev => ({ ...prev, [event.stageId || '']: 'active' }))
        setCurrentStageId(event.stageId || null)
        if (event.message) {
          setTickerItems(prev => [...prev, {
            id: nextTickerId(`ticker-${event.stageId}`),
            message: event.message || '',
            type: 'info',
            timestamp: Date.now(),
          }])
        }
        break

      case 'progress_stage_completed':
        setStageStatuses(prev => ({ ...prev, [event.stageId || '']: 'completed' }))
        setTickerItems(prev => [...prev, {
          id: nextTickerId(`ticker-${event.stageId}-done`),
          message: `${event.label || event.stageId} ✓`,
          type: 'found',
          timestamp: Date.now(),
        }])
        break

      case 'progress_stage_warning':
        setStageStatuses(prev => ({ ...prev, [event.stageId || '']: 'warning' }))
        if (event.message) {
          setTickerItems(prev => [...prev, {
            id: nextTickerId(`ticker-${event.stageId}-warn`),
            message: event.message as string,
            type: 'warning' as const,
            timestamp: Date.now(),
          }])
        }
        break

      case 'progress_stage_failed':
        setStageStatuses(prev => ({ ...prev, [event.stageId || '']: 'failed' }))
        if (event.message) {
          setTickerItems(prev => [...prev, {
            id: nextTickerId(`ticker-${event.stageId}-fail`),
            message: event.message as string,
            type: 'error' as const,
            timestamp: Date.now(),
          }])
        }
        setError({
          type: 'api_down',
          message: event.message || 'Uma etapa falhou.',
          action: { label: 'Tentar novamente', handler: () => {} },
        })
        break

      case 'evidence_found':
        setTickerItems(prev => [...prev, {
          id: nextTickerId('evidence'),
          message: event.message || 'Evidência encontrada',
          type: 'found',
          timestamp: Date.now(),
        }])
        break

      case 'source_checked':
        if (event.source) {
          const statusMap: Record<string, SourceStatusItem['status']> = {
            ok: 'ok',
            failed: 'falhou',
            cache: 'cache',
            consulting: 'consultando',
            ignored: 'ignorado',
          }
          const severity = event.severity || 'info'
          const status = severity === 'error' ? 'falhou' : severity === 'warning' ? 'cache' : 'ok'
          setSourceStatuses(prev => {
            const existing = prev.findIndex(s => s.name === event.source)
            const item: SourceStatusItem = {
              name: event.source || '',
              label: event.source || '',
              status: statusMap[status] || status as SourceStatusItem['status'],
            }
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = item
              return updated
            }
            return [...prev, item]
          })
        }
        break

      case 'confidence_updated':
        if (event.confidence !== undefined) {
          const level: ConfidenceLevel = event.confidence >= 0.7 ? 'alta' : event.confidence >= 0.4 ? 'média' : 'baixa'
          setConfidence(level)
        }
        break

      case 'final_response_ready':
        setResult(event.metadata as Record<string, unknown> || {})
        setIsActive(false)
        if (timerRef.current) clearInterval(timerRef.current)
        // Complete all remaining stages
        setStageStatuses(prev => {
          const updated = { ...prev }
          SCOUT_STAGES.forEach(stage => {
            if (updated[stage.id] !== 'completed' && updated[stage.id] !== 'failed' && updated[stage.id] !== 'warning') {
              updated[stage.id] = 'completed'
            }
          })
          return updated
        })
        break
    }
  }

  const cancel = () => {
    setIsCancelling(true)
    if (abortRef.current) {
      abortRef.current.abort()
    }
    if (timerRef.current) clearInterval(timerRef.current)
  }

  return {
    stageStatuses,
    currentStageId,
    tickerItems,
    sourceStatuses,
    confidence,
    elapsedSeconds,
    isCancelling,
    isActive,
    result,
    error,
    startInvestigation,
    cancel,
  }
}
