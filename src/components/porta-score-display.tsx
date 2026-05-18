'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface DimensionNote {
  score?: number
  justification?: string
  evidences?: string[]
  confidence?: string
  gaps?: string[]
  penalty?: number
}

interface PortaScoreData {
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

const DIMENSIONS = [
  { key: 'porte' as const, letter: 'P', name: 'Porte', weight: 0.10 },
  { key: 'operacao' as const, letter: 'O', name: 'Operação', weight: 0.25 },
  { key: 'retorno' as const, letter: 'R', name: 'Retorno', weight: 0.10 },
  { key: 'tecnologia' as const, letter: 'T', name: 'Tecnologia', weight: 0.30 },
  { key: 'adocao' as const, letter: 'A', name: 'Adoção', weight: 0.25 },
]

const SECTOR_LABELS: Record<string, string> = {
  agro: 'Agro', construction: 'Construção', retail: 'Varejo',
  industry: 'Indústria', services: 'Serviços', logistics: 'Logística',
}

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

function getScoreColor(score: number): string {
  if (score >= 8) return 'bg-green-500'
  if (score >= 6) return 'bg-emerald-500'
  if (score >= 3) return 'bg-amber-500'
  return 'bg-rose-500'
}

function getScoreTextColor(score: number): string {
  if (score >= 8) return 'text-green-600'
  if (score >= 6) return 'text-emerald-600'
  if (score >= 3) return 'text-amber-600'
  return 'text-rose-600'
}

function getScoreBgColor(score: number): string {
  if (score >= 8) return 'bg-green-50 dark:bg-green-950/30'
  if (score >= 6) return 'bg-emerald-50 dark:bg-emerald-950/30'
  if (score >= 3) return 'bg-amber-50 dark:bg-amber-950/30'
  return 'bg-rose-50 dark:bg-rose-950/30'
}

function getConfidenceColor(confidence?: string): string {
  switch (confidence) {
    case 'high': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'low': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
    default: return 'bg-slate-100 text-slate-700'
  }
}

export function PortaScoreDisplay({ score }: { score: PortaScoreData }) {
  const [expandedDims, setExpandedDims] = useState<Record<string, boolean>>({})

  let parsedNotes: Record<string, DimensionNote> = {}
  if (score.notes) {
    try {
      parsedNotes = JSON.parse(score.notes)
    } catch {
      // keep empty
    }
  }

  const toggleDim = (key: string) => {
    setExpandedDims(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <Card className={`${getScoreBgColor(score.total)} border-0`}>
      <CardContent className="p-4 space-y-4">
        {/* Total Score */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Score PORTA</p>
            <p className={`text-4xl font-bold ${getScoreTextColor(score.total)}`}>
              {score.total.toFixed(1)}
            </p>
          </div>
          <div className="text-right space-y-1">
            {score.sector && (
              <Badge variant="secondary" className="text-xs">
                {SECTOR_LABELS[score.sector] || score.sector}
              </Badge>
            )}
            {score.subSector && (
              <div>
                <Badge variant="outline" className="text-[10px]">
                  {SUB_SECTOR_LABELS[score.subSector] || score.subSector}
                </Badge>
              </div>
            )}
            <p className="text-xs text-muted-foreground">0-10 escala</p>
          </div>
        </div>

        {/* Dimension Bars */}
        <div className="space-y-2.5">
          {DIMENSIONS.map((dim) => {
            const value = score[dim.key]
            const note = parsedNotes[dim.key]
            const hasDetail = note && (note.justification || (note.evidences && note.evidences.length > 0) || (note.gaps && note.gaps.length > 0))
            const isExpanded = expandedDims[dim.key]

            return (
              <div key={dim.key} className="space-y-1">
                <div
                  className={`flex items-center justify-between text-sm ${hasDetail ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded px-1 -mx-1' : ''}`}
                  onClick={() => hasDetail && toggleDim(dim.key)}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`font-bold ${getScoreTextColor(value)}`}>
                      {dim.letter}
                    </span>
                    <span className="text-muted-foreground">{dim.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(dim.weight * 100).toFixed(0)}%)
                    </span>
                    {note?.confidence && (
                      <Badge className={`text-[9px] px-1 py-0 ${getConfidenceColor(note.confidence)}`}>
                        {note.confidence === 'high' ? 'Alta' : note.confidence === 'medium' ? 'Média' : 'Baixa'}
                      </Badge>
                    )}
                    {note?.penalty && note.penalty < 0 && (
                      <span className="text-[9px] text-rose-500">{note.penalty}</span>
                    )}
                    {hasDetail && (
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </span>
                  <span className={`font-semibold ${getScoreTextColor(value)}`}>
                    {value.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getScoreColor(value)}`}
                    style={{ width: `${Math.min(100, value * 10)}%` }}
                  />
                </div>

                {/* Expandable dimension detail */}
                {hasDetail && isExpanded && (
                  <div className="ml-3 pl-3 border-l-2 border-muted space-y-1.5 py-1">
                    {note.justification && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Justificativa:</span> {note.justification}
                      </p>
                    )}
                    {note.evidences && note.evidences.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Evidências:</p>
                        {note.evidences.map((ev, i) => (
                          <p key={i} className="text-[10px] text-muted-foreground pl-2">• {ev}</p>
                        ))}
                      </div>
                    )}
                    {note.gaps && note.gaps.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400">Lacunas:</p>
                        {note.gaps.map((g, i) => (
                          <p key={i} className="text-[10px] text-muted-foreground pl-2">• {g}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
