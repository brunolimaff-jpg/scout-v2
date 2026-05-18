'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface PortaScoreData {
  porte: number
  operacao: number
  retorno: number
  tecnologia: number
  adocao: number
  total: number
  sector?: string | null
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
  agro: 'Agro',
  construction: 'Construção',
  retail: 'Varejo',
  industry: 'Indústria',
  services: 'Serviços',
  logistics: 'Logística',
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

export function PortaScoreDisplay({ score }: { score: PortaScoreData }) {
  const parsedNotes: Record<string, string> | null = score.notes
    ? (() => {
        try {
          return JSON.parse(score.notes)
        } catch {
          return null
        }
      })()
    : null

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
          <div className="text-right">
            {score.sector && (
              <Badge variant="secondary" className="text-xs">
                {SECTOR_LABELS[score.sector] || score.sector}
              </Badge>
            )}
            <p className="text-xs text-muted-foreground mt-1">0-10 escala</p>
          </div>
        </div>

        {/* Dimension Bars */}
        <div className="space-y-2.5">
          {DIMENSIONS.map((dim) => {
            const value = score[dim.key]
            return (
              <div key={dim.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className={`font-bold ${getScoreTextColor(value)}`}>
                      {dim.letter}
                    </span>
                    <span className="text-muted-foreground">{dim.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(dim.weight * 100).toFixed(0)}%)
                    </span>
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
                {parsedNotes?.[dim.key] && (
                  <p className="text-xs text-muted-foreground pl-1">{parsedNotes[dim.key]}</p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
