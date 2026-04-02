import { useState, useRef, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

function buildSystemPrompt(tasks: any[], timetable: any[]): string {
  const taskList = tasks.length === 0
    ? 'No tasks yet.'
    : tasks.map(t =>
        `- [${t.completed ? 'DONE' : 'TODO'}] "${t.title}" | Subject: ${t.subject || 'N/A'} | Difficulty: ${t.priority} | Deadline: ${t.deadline ? new Date(t.deadline).toLocaleString() : 'None'}`
      ).join('\n');

  const ttList = timetable.length === 0
    ? 'No timetable entries yet.'
    : timetable.map(e => {
        const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        return `- ${days[e.day]}: ${e.subject} ${e.startTime}–${e.endTime}`;
      }).join('\n');

  return `You are Questify AI, an academic assistant built into the Questify student productivity app. You help students manage their academic workload with warmth, calm, and practical focus — like a smart study buddy.

CURRENT USER DATA:
=== TASKS ===
${taskList}

=== TIMETABLE ===
${ttList}

YOUR CAPABILITIES:
- Read and discuss the user's tasks and timetable above
- Suggest priority orders based on deadlines and difficulty
- Help manage academic stress by giving a calm, practical breakdown
- Add, edit, or delete tasks and timetable entries when the user asks

WHEN MAKING CHANGES:
If the user asks you to add/edit/delete a task or timetable entry, you MUST respond with a JSON action block at the END of your message, formatted exactly like this:
<action>
{"type":"ADD_TASK","task":{"title":"...","priority":"easy|medium|hard","subject":"...","deadline":"ISO_STRING_OR_NULL"}}
</action>
OR
<action>
{"type":"DELETE_TASK","taskId":"EXACT_ID_FROM_TASK_LIST"}
</action>
OR
<action>
{"type":"ADD_TIMETABLE","entry":{"subject":"...","day":0,"startTime":"09:00","endTime":"10:00"}}
</action>
OR
<action>
{"type":"DELETE_TIMETABLE","entryId":"EXACT_ID"}
</action>

COUNTER-QUESTIONING: If the user's request is missing required fields, ask for them ONE AT A TIME before executing. For tasks: need title, subject, difficulty, (optionally deadline). For timetable: need subject, day, start time, end time. Only produce the <action> block once you have all required info.

HARD LIMITS — you must NEVER:
- Purchase, apply, or suggest purchasing any shop items
- Grant, deduct, or modify coins or XP
- Activate or deactivate any power-ups or effects
- Discuss anything unrelated to the user's academics, schedule, tasks, or study stress
- Access or modify any other user's data
If asked to do any of these, politely decline: "I can only help with your tasks and timetable — for shop items, head to the Shop page!"

TONE: Calm, warm, encouraging, concise. No corporate speak. Keep responses short and actionable unless the user wants depth.`;
}

export function AIChatbot() {
  const { state, dispatch } = useGame();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const parseAndExecuteAction = (content: string) => {
    const match = content.match(/<action>([\s\S]*?)<\/action>/);
    if (!match) return;
    try {
      const action = JSON.parse(match[1].trim());
      if (action.type === 'ADD_TASK') {
        const task = {
          id: crypto.randomUUID(),
          title: action.task.title,
          completed: false,
          priority: action.task.priority || 'medium',
          subject: action.task.subject || undefined,
          subjectColor: undefined,
          deadline: action.task.deadline || undefined,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_TASK', task });
        toast.success(`✅ Task added: "${task.title}"`);
      } else if (action.type === 'DELETE_TASK') {
        dispatch({ type: 'DELETE_TASK', taskId: action.taskId });
        toast.success('🗑️ Task removed');
      } else if (action.type === 'ADD_TIMETABLE') {
        const entry = {
          id: crypto.randomUUID(),
          subject: action.entry.subject,
          subjectColor: '#6366f1' as any,
          day: action.entry.day,
          startTime: action.entry.startTime,
          endTime: action.entry.endTime,
        };
        dispatch({ type: 'ADD_TIMETABLE_ENTRY', entry });
        toast.success(`📅 Timetable updated: ${entry.subject}`);
      } else if (action.type === 'DELETE_TIMETABLE') {
        dispatch({ type: 'DELETE_TIMETABLE_ENTRY', entryId: action.entryId });
        toast.success('📅 Timetable entry removed');
      }
    } catch {
      // malformed action JSON — ignore silently
    }
  };

  const stripAction = (content: string) =>
    content.replace(/<action>[\s\S]*?<\/action>/g, '').trim();

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    let assistantContent = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          system: buildSystemPrompt(state.tasks, state.timetable),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      const upsertAssistant = (content: string) => {
        assistantContent = content;
        const display = stripAction(content);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: display } : m));
          }
          return [...prev, { role: 'assistant', content: display }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) upsertAssistant(assistantContent + delta);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Execute any actions from the full response
      parseAndExecuteAction(assistantContent);
    } catch (e: any) {
      const errorMsg = e?.message || 'Something went wrong — try again.';
      toast.error(errorMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errorMsg}` }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        title="Questify AI Assistant"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x"    initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}><X className="h-6 w-6" /></motion.span>
            : <motion.span key="chat" initial={{ rotate:  90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}><MessageCircle className="h-6 w-6" /></motion.span>
          }
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-24 right-6 z-50 w-[min(400px,calc(100vw-1.5rem))] h-[min(600px,calc(100vh-8rem))] glass-card flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-base leading-tight">Questify AI</p>
                <p className="text-sm text-muted-foreground">Academic Assistant</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {showDisclaimer && (
                <div className="bg-muted/60 rounded-xl p-3 text-sm text-muted-foreground flex gap-2">
                  <span>ℹ️</span>
                  <span>I can help you manage tasks, plan your timetable, and handle academic stress. I can't buy items or change your XP.</span>
                  <button onClick={() => setShowDisclaimer(false)} className="ml-auto shrink-0 hover:text-foreground">✕</button>
                </div>
              )}

              {messages.length === 0 && !showDisclaimer && (
                <div className="text-center text-muted-foreground text-base py-8">
                  <p className="text-2xl mb-2">📚</p>
                  <p>Ask me anything about your tasks, timetable, or study plan!</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border shrink-0">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ask me about your tasks or timetable…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  rows={1}
                  className="resize-none min-h-[40px] max-h-[120px] text-base"
                  style={{ fieldSizing: 'content' } as any}
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="shrink-0 h-10 w-10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
