'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Search,
  Users,
  Radar,
  TrendingUp,
  Loader2,
  Activity,
  DollarSign,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// ---------- Types ----------

interface DashboardStats {
  totalInvestigations: number
  statusBreakdown: Record<string, number>
  avgPortaScore: number
  portaAverages: {
    porte: number
    operacao: number
    retorno: number
    tecnologia: number
    adocao: number
  } | null
  totalAccounts: number
  stageBreakdown: Record<string, number>
  totalRadarEntries: number
  categoryBreakdown: Record<string, number>
  recentActivity: Array<{
    type: 'investigation' | 'account' | 'radar'
    id: string
    title: string
    status: string
    createdAt: string
  }>
  pipelineValue: number
}

// ---------- Helpers ----------

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualificado',
  proposal: 'Proposta',
  negotiation: 'Negociação',
  closed_won: 'Ganho',
  closed_lost: 'Perdido',
}

const CATEGORY_LABELS: Record<string, string> = {
  competitor: 'Competidor',
  market_trend: 'Tendência',
  regulation: 'Regulamentação',
  technology: 'Tecnologia',
  opportunity: 'Oportunidade',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  investigating: 'Investigando',
  completed: 'Concluída',
  failed: 'Falhou',
}

const PIE_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#64748b', // slate
]

// ---------- Component ----------

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Erro ao carregar estatísticas</p>
      </div>
    )
  }

  // Prepare chart data
  const portaDistribution = [
    { name: 'P - Porte', value: stats.portaAverages?.porte || 0, fill: '#10b981' },
    { name: 'O - Operação', value: stats.portaAverages?.operacao || 0, fill: '#f59e0b' },
    { name: 'R - Retorno', value: stats.portaAverages?.retorno || 0, fill: '#06b6d4' },
    { name: 'T - Tecnologia', value: stats.portaAverages?.tecnologia || 0, fill: '#8b5cf6' },
    { name: 'A - Adoção', value: stats.portaAverages?.adocao || 0, fill: '#f43f5e' },
  ]

  const accountsByStage = Object.entries(stats.stageBreakdown || {}).map(
    ([stage, count]) => ({
      name: STAGE_LABELS[stage] || stage,
      value: count,
    })
  )

  const radarByCategory = Object.entries(stats.categoryBreakdown || {}).map(
    ([cat, count]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      value: count,
    })
  )

  const hasData =
    stats.totalInvestigations > 0 ||
    stats.totalAccounts > 0 ||
    stats.totalRadarEntries > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <LayoutDashboard className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Dashboard</h2>
            <p className="text-xs text-muted-foreground">Visão Geral</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Search className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs text-muted-foreground">Investigações</p>
                </div>
                <p className="text-2xl font-bold">{stats.totalInvestigations}</p>
                {stats.statusBreakdown && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(stats.statusBreakdown).map(([status, count]) => (
                      <span key={status} className="text-[10px] text-muted-foreground">
                        {STATUS_LABELS[status] || status}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  <p className="text-xs text-muted-foreground">Score PORTA Médio</p>
                </div>
                <p className="text-2xl font-bold">
                  {stats.avgPortaScore > 0 ? stats.avgPortaScore.toFixed(1) : '—'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-amber-500" />
                  <p className="text-xs text-muted-foreground">Contas no CRM</p>
                </div>
                <p className="text-2xl font-bold">{stats.totalAccounts}</p>
                {stats.pipelineValue > 0 && (
                  <p className="text-[10px] text-emerald-600 flex items-center gap-0.5 mt-1">
                    <DollarSign className="h-2.5 w-2.5" />
                    Pipeline: R$ {stats.pipelineValue.toLocaleString('pt-BR')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Radar className="h-4 w-4 text-teal-500" />
                  <p className="text-xs text-muted-foreground">Entradas no Radar</p>
                </div>
                <p className="text-2xl font-bold">{stats.totalRadarEntries}</p>
              </CardContent>
            </Card>
          </div>

          {!hasData && (
            <Card>
              <CardContent className="py-8 text-center space-y-4">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Nenhum dado disponível ainda.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Comece usando o Scout para investigar empresas, o Radar para inteligência
                    competitiva, ou o War Room para consultar documentação Senior.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          {hasData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* PORTA Score Distribution */}
              {stats.avgPortaScore > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Distribuição PORTA (Médias)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={portaDistribution}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {portaDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Accounts by Stage */}
              {accountsByStage.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Contas por Estágio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={accountsByStage}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {accountsByStage.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Radar by Category */}
              {radarByCategory.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Radar por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={radarByCategory}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity */}
              {stats.recentActivity && stats.recentActivity.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Atividade Recente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {stats.recentActivity.map((activity, i) => (
                        <div
                          key={`${activity.type}-${activity.id}-${i}`}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                        >
                          <div className="flex-shrink-0">
                            {activity.type === 'investigation' && (
                              <Search className="h-4 w-4 text-emerald-500" />
                            )}
                            {activity.type === 'account' && (
                              <Users className="h-4 w-4 text-amber-500" />
                            )}
                            {activity.type === 'radar' && (
                              <Radar className="h-4 w-4 text-teal-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {activity.title}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px]">
                                {activity.type === 'investigation'
                                  ? 'Scout'
                                  : activity.type === 'account'
                                  ? 'CRM'
                                  : 'Radar'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(activity.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
