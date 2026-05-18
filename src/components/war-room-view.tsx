'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  ChatLoadingIndicator,
  WARROOM_STAGES,
  WARROOM_EMPTY_STATES,
  EmptyState,
  useEstimatedProgress,
} from '@/components/investigation-loader'
import {
  Send,
  Plus,
  MessageSquare,
  ChevronDown,
  ExternalLink,
  Loader2,
  BookOpen,
  Trash2,
  Sparkles,
  Target,
  MessageCircle,
  Lightbulb,
  FileSearch,
  ArrowRight,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

// ---------- Types ----------

interface WarRoomSource {
  id: string
  title: string
  url: string
  snippet: string
  relevance: number
}

interface WarRoomMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  intent?: string | null
  confidence?: string | null
  product?: string | null
  module?: string | null
  sources: WarRoomSource[]
  createdAt: string
}

interface WarRoomSession {
  id: string
  title: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

// ---------- Helpers ----------

const INTENT_LABELS: Record<string, string> = {
  documentation: 'Documentação',
  error: 'Erro do Cliente',
  config: 'Configuração',
  step_by_step: 'Passo a Passo',
  concept: 'Conceito',
  integration: 'Integração',
  business_rule: 'Regra de Negócio',
  commercial: 'Argumento Comercial',
  client_doubt: 'Dúvida do Cliente',
  unrelated: 'Não Relacionado',
}

const INTENT_ICONS: Record<string, React.ElementType> = {
  documentation: FileSearch,
  error: MessageCircle,
  config: Lightbulb,
  commercial: Target,
  client_doubt: MessageCircle,
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'Alta', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  medium: { label: 'Média', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  low: { label: 'Baixa', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' },
}

// Commercial-focused suggested questions organized by mode
const SUGGESTED_MODES = [
  {
    id: 'understand',
    label: 'Entender',
    icon: FileSearch,
    color: 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
    questions: [
      'Explique esta rotina em linguagem de vendedor',
      'O que este módulo faz na prática?',
      'Resuma essa integração em 5 pontos',
      'Onde encontro a documentação oficial sobre isso?',
    ],
  },
  {
    id: 'sell',
    label: 'Vender',
    icon: Target,
    color: 'text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/30',
    questions: [
      'Quais dores este módulo resolve?',
      'Transforme essa funcionalidade em argumento comercial',
      'O que devo perguntar antes de oferecer essa solução?',
      'Monte perguntas para diagnosticar o cliente',
    ],
  },
  {
    id: 'respond',
    label: 'Responder Cliente',
    icon: MessageCircle,
    color: 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30',
    questions: [
      'Me ajude a responder uma dúvida do cliente',
      'Quais pré-requisitos preciso validar?',
      'Qual documentação posso enviar para o cliente?',
      'O que significa esse erro que o cliente mandou?',
    ],
  },
]

// ---------- Component ----------

export function WarRoomView() {
  const [sessions, setSessions] = useState<WarRoomSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<WarRoomMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [showSessionList, setShowSessionList] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})
  const [activeMode, setActiveMode] = useState<string>('understand')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Loading progress (estimated for War Room)
  const {
    stageStatuses,
    currentStageId,
    tickerItems,
    elapsedSeconds,
    isCancelling,
    completeAll,
    cancel: cancelProgress,
  } = useEstimatedProgress(WARROOM_STAGES, isLoading, () => {})

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/warroom/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch { /* */ }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoadingSession(true)
    try {
      const res = await fetch(`/api/warroom/sessions/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages((data.messages || []).map((m: WarRoomMessage) => ({ ...m, sources: m.sources || [] })))
        setCurrentSessionId(sessionId)
      }
    } catch { toast.error('Erro ao carregar sessão') }
    finally { setIsLoadingSession(false) }
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/warroom/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Nova Sessão' }) })
      if (res.ok) {
        const session = await res.json()
        setSessions(prev => [session, ...prev])
        setCurrentSessionId(session.id)
        setMessages([])
        setShowSessionList(false)
      }
    } catch { toast.error('Erro ao criar sessão') }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/warroom/sessions/${sessionId}`, { method: 'DELETE' })
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (currentSessionId === sessionId) { setCurrentSessionId(null); setMessages([]) }
        toast.success('Sessão excluída')
      }
    } catch { toast.error('Erro ao excluir sessão') }
  }

  const sendMessage = async (messageText?: string) => {
    const text = (messageText || input).trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)

    const tempUserMsg: WarRoomMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: text,
      sources: [],
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const res = await fetch('/api/warroom/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId || undefined, message: text }),
        signal: abortController.signal,
      })

      if (!res.ok) throw new Error('Failed to send message')

      const data = await res.json()

      // Complete loading progress
      completeAll()

      if (!currentSessionId && data.sessionId) {
        setCurrentSessionId(data.sessionId)
        await loadSessions()
      }

      const assistantMsg: WarRoomMessage = {
        id: data.assistantMessageId || `temp-asst-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        intent: data.intent,
        confidence: data.confidence,
        product: data.keyTerms?.product,
        module: data.keyTerms?.module,
        sources: data.sources || [],
        createdAt: new Date().toISOString(),
      }

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        { ...tempUserMsg, id: data.userMessageId || tempUserMsg.id, intent: data.intent, product: data.keyTerms?.product, module: data.keyTerms?.module },
        assistantMsg,
      ])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('Consulta cancelada')
      } else {
        toast.error('Erro ao consultar. Tente novamente.')
      }
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const toggleSources = (messageId: string) => {
    setExpandedSources(prev => ({ ...prev, [messageId]: !prev[messageId] }))
  }

  const cancelLoading = () => {
    if (abortRef.current) abortRef.current.abort()
    cancelProgress()
  }

  const currentSession = sessions.find(s => s.id === currentSessionId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">War Room</h2>
              <p className="text-xs text-muted-foreground">
                Apoio Comercial Senior
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs hidden sm:flex">
              documentacao.senior.com.br
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setShowSessionList(!showSessionList)}>
              <MessageSquare className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Sessões</span>
            </Button>
            <Button variant="outline" size="sm" onClick={createNewSession}>
              <Plus className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Nova</span>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Consulte a documentação oficial e transforme rotinas, módulos e integrações em respostas claras para clientes.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Session Sidebar */}
        {showSessionList && (
          <div className="w-64 border-r bg-background flex-shrink-0 overflow-y-auto">
            <div className="p-3">
              <h3 className="text-sm font-semibold mb-2">Sessões Recentes</h3>
              <div className="space-y-1.5">
                {sessions.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma sessão ainda.</p>}
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors ${
                      session.id === currentSessionId ? 'bg-emerald-100 dark:bg-emerald-900/30 font-medium' : 'hover:bg-muted'
                    }`}
                    onClick={() => loadSession(session.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs">{session.title}</p>
                      <p className="text-[10px] text-muted-foreground">{session.messageCount} msgs</p>
                    </div>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {currentSession && (
            <div className="px-4 py-1.5 border-b bg-muted/30 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              <span className="text-xs font-medium truncate">{currentSession.title}</span>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 px-4">
            <div className="max-w-3xl mx-auto py-4 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="space-y-6 py-8">
                  <div className="text-center space-y-2">
                    <div className="inline-flex p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                      <BookOpen className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold">War Room — Apoio Comercial Senior</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Pergunte sobre soluções Senior, módulos, rotinas, integrações e dúvidas de clientes. O War Room consulta a documentação oficial e traduz em resposta prática para vendas.
                    </p>
                  </div>

                  {/* Mode selector + suggestions */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      {SUGGESTED_MODES.map(mode => {
                        const Icon = mode.icon
                        return (
                          <button
                            key={mode.id}
                            onClick={() => setActiveMode(mode.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              activeMode === mode.id ? mode.color : 'text-muted-foreground border-muted hover:border-foreground/20'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {mode.label}
                          </button>
                        )
                      })}
                    </div>

                    {SUGGESTED_MODES.filter(m => m.id === activeMode).map(mode => (
                      <div key={mode.id} className="flex flex-wrap gap-2 justify-center">
                        {mode.questions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => sendMessage(q)}
                            className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors text-left"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Quick action cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto">
                    {[
                      { icon: FileSearch, label: 'Entender uma solução' },
                      { icon: MessageCircle, label: 'Responder dúvida de cliente' },
                      { icon: Target, label: 'Preparar reunião' },
                      { icon: BookOpen, label: 'Encontrar documentação' },
                      { icon: Lightbulb, label: 'Argumento comercial' },
                      { icon: ArrowRight, label: 'Validar pré-requisitos' },
                    ].map((item, i) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={i}
                          className="flex items-center gap-2 p-2.5 rounded-lg border bg-background hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors text-left"
                          onClick={() => setInput(item.label)}
                        >
                          <Icon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-[11px] text-muted-foreground">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {isLoadingSession && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-muted'}`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {msg.role === 'assistant' && (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {msg.confidence && CONFIDENCE_LABELS[msg.confidence] && (
                            <Badge variant="secondary" className={`text-[10px] ${CONFIDENCE_LABELS[msg.confidence].color}`}>
                              Confiança: {CONFIDENCE_LABELS[msg.confidence].label}
                            </Badge>
                          )}
                          {msg.intent && INTENT_LABELS[msg.intent] && (
                            <Badge variant="outline" className="text-[10px]">
                              {INTENT_LABELS[msg.intent]}
                            </Badge>
                          )}
                          {msg.product && <Badge variant="outline" className="text-[10px]">{msg.product}</Badge>}
                          {msg.module && <Badge variant="outline" className="text-[10px]">{msg.module}</Badge>}
                        </div>

                        {msg.sources && msg.sources.length > 0 && (
                          <Collapsible open={expandedSources[msg.id]} onOpenChange={() => toggleSources(msg.id)}>
                            <CollapsibleTrigger asChild>
                              <button className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                                <span>{msg.sources.length} fonte{msg.sources.length !== 1 ? 's' : ''}</span>
                                <ChevronDown className={`h-3 w-3 transition-transform ${expandedSources[msg.id] ? 'rotate-180' : ''}`} />
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 space-y-2">
                                {msg.sources.map(source => (
                                  <div key={source.id} className="p-2 rounded-md bg-background/60 border text-xs space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-medium truncate flex-1">{source.title}</p>
                                      <Badge variant="secondary" className="text-[9px] flex-shrink-0">{(source.relevance * 100).toFixed(0)}%</Badge>
                                    </div>
                                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate">
                                      <ExternalLink className="h-3 w-3 flex-shrink-0" /><span className="truncate">{source.url}</span>
                                    </a>
                                    {source.snippet && <p className="text-muted-foreground line-clamp-2">{source.snippet}</p>}
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {msg.confidence === 'low' && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <span>⚠ Lacunas identificadas na documentação</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <ChatLoadingIndicator
                  stages={WARROOM_STAGES}
                  stageStatuses={stageStatuses}
                  currentStageId={currentStageId}
                  tickerItems={tickerItems}
                  elapsedSeconds={elapsedSeconds}
                  onCancel={cancelLoading}
                  isCancelling={isCancelling}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t bg-background p-3">
            <div className="max-w-3xl mx-auto flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre soluções Senior, dúvidas de cliente, argumentos de venda..."
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
                disabled={isLoading}
              />
              <Button onClick={() => sendMessage()} disabled={isLoading || !input.trim()} size="icon" className="bg-emerald-600 hover:bg-emerald-700 flex-shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
