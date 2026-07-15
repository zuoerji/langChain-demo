import {
  Bot,
  CheckCircle2,
  Database,
  GitBranch,
  Hammer,
  MessageSquareText,
  Play,
  Radio,
  Send,
  Workflow,
  XCircle,
} from "lucide-react";
import parse from 'html-react-parser';
import { useMemo, useState } from "react";
import { getJson, postJson, prettyJson, streamPost } from "./api";

type TabId = "chat" | "stream" | "tools" | "rag" | "graph" | "approval";

type ApiState = {
  loading: boolean;
  error: string;
  result: {
    input: string,
    output: string
  };
};

const initialApiState: ApiState = {
  loading: false,
  error: "",
  result: {
    input: '',
    output: ''
  },
};

const tabs: Array<{ id: TabId; label: string; icon: typeof MessageSquareText }> = [
  { id: "chat", label: "基础聊天", icon: MessageSquareText },
  { id: "stream", label: "流式输出", icon: Radio },
  { id: "tools", label: "工具调用", icon: Hammer },
  // { id: "rag", label: "RAG 问答", icon: Database },
  // { id: "graph", label: "工作流", icon: GitBranch },
  // { id: "approval", label: "人工审批", icon: Workflow },
];

function useApiState() {
  const [state, setState] = useState<ApiState>(initialApiState);

  async function run(action: () => Promise<{ input: string, output: string }>) {
    setState({ loading: true, error: "", result: { input:'', output: '' } });
    try {
      const result = await action();
      console.log(result,'==res==')
      setState({ loading: false, error: "", result: result });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
        result: { input:'', output: '' },
      });
    }
  }

  return { state, setState, run };
}

function ResultPanel({ state }: { state: ApiState }) {
  return (
    <section className="result-panel" aria-live="polite">
      <div className="panel-title">
        <Bot size={18} />
        <span>响应</span>
      </div>
      {state.loading ? <div className="empty-state">请求中...</div> : null}
      {state.error ? <div className="error-state">{state.error}</div> : null}
      {!state.loading && !state.error && state.result ? (
        <pre>{typeof state.result === "string" ? state.result : state.result?.output}</pre>
      ) : null}
      {!state.loading && !state.error && !state.result ? <div className="empty-state">点击运行后查看接口返回</div> : null}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="field-label">{children}</label>;
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button className={`action-button ${variant}`} type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function ChatDemo() {
  const { state, run } = useApiState();
  const [input, setInput] = useState("你是谁");
  const [threadId, setThreadId] = useState("course-user-1");

  return (
    <DemoLayout
      title="基础聊天"
      left={
        <>
          <FieldLabel>输入</FieldLabel>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} />
          <div className="field-grid">
            <div>
              <FieldLabel>Thread ID</FieldLabel>
              <input value={threadId} onChange={(event) => setThreadId(event.target.value)} />
            </div>
          </div>
          <div className="button-row">
            <ActionButton onClick={() => run(() => postJson("/api/lc/chat/simple", { input }))}>
              <Play size={16} />
              单轮聊天
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() =>
                run(() =>
                  postJson("/api/lc/agent/chat", {
                    threadId,
                    input,
                  }),
                )
              }
            >
              <MessageSquareText size={16} />
              带记忆聊天
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => run(() => getJson(`/api/lc/agent/threads/${threadId}`))}>
              <Database size={16} />
              查看记忆
            </ActionButton>
          </div>
        </>
      }
      right={<ResultPanel state={state} />}
    />
  );
}

function StreamDemo() {
  const [input, setInput] = useState("解析一下《早发白帝城》");
  const [output, setOutput] = useState("");
  const [events, setEvents] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runStream() {
    setOutput("");
    setEvents([]);
    setError("");
    setLoading(true);

    try {
      await streamPost("/api/lc/chat/stream", { input }, (event, data) => {
        setEvents((current) => current.concat({ event, data }));
        if (event === "token") {
          const token = (data as { token?: string }).token ?? "";
          setOutput((current) => current + token);
        }
      });
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : "Unknown stream error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DemoLayout
      title="流式输出"
      left={
        <>
          <FieldLabel>输入</FieldLabel>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} />
          <div className="button-row">
            <ActionButton onClick={runStream} disabled={loading}>
              <Radio size={16} />
              开始流式生成
            </ActionButton>
          </div>
        </>
      }
      right={
        <section className="result-panel">
          <div className="panel-title">
            <Radio size={18} />
            <span>Token 输出</span>
          </div>
          {loading ? <div className="empty-state">流式连接中...</div> : null}
          {error ? <div className="error-state">{error}</div> : null}
          <div className="stream-output">{output || "等待 token..."}</div>
          <details>
            <summary>查看 SSE 事件</summary>
            <pre>{prettyJson(events)}</pre>
          </details>
        </section>
      }
    />
  );
}

function ToolsDemo() {
  const { state, run } = useApiState();
  const [input, setInput] = useState("查看订单 1001");
  const [expression, setExpression] = useState("12 * (3 + 4)");

  return (
    <DemoLayout
      title="工具调用"
      left={
        <>
          <FieldLabel>自然语言请求</FieldLabel>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} />
          <FieldLabel>计算表达式</FieldLabel>
          <input value={expression} onChange={(event) => setExpression(event.target.value)} />
          <div className="button-row">
            <ActionButton onClick={() => run(() => postJson("/api/lc/tools/ask", { input }))}>
              <Send size={16} />
              自动选择工具
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() => run(() => postJson("/api/lc/tools/calculator", { expression }))}
            >
              <Hammer size={16} />
              直接调用计算器
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => run(() => getJson("/api/lc/tools"))}>
              <Database size={16} />
              工具列表
            </ActionButton>
          </div>
        </>
      }
      right={<ResultPanel state={state} />}
    />
  );
}

function RagDemo() {
  const { state, run } = useApiState();
  const [title, setTitle] = useState("退款规则");
  const [content, setContent] = useState("订单发货前可以直接退款，发货后需要等物流签收或拒收后进入退款流程。");
  const [question, setQuestion] = useState("发货后还能退款吗？");

  return (
    <DemoLayout
      title="RAG 知识库问答"
      left={
        <>
          <FieldLabel>文档标题</FieldLabel>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
          <FieldLabel>文档内容</FieldLabel>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} />
          <FieldLabel>问题</FieldLabel>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} />
          <div className="button-row">
            <ActionButton onClick={() => run(() => postJson("/api/lc/rag/ingest", { title, content }))}>
              <Database size={16} />
              导入知识
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() =>
                run(() =>
                  postJson("/api/lc/rag/query", {
                    question,
                    topK: 3,
                  }),
                )
              }
            >
              <Send size={16} />
              提问
            </ActionButton>
          </div>
        </>
      }
      right={<ResultPanel state={state} />}
    />
  );
}

function GraphDemo() {
  const { state, run } = useApiState();
  /**
    我昨天买的东西今天还没发货，
    客服也没人回，
    我很生气，
    想退款。

    我想对订单进行投诉 1001
   * */ 
  const [input, setInput] = useState(`    我昨天买的东西今天还没发货，
    客服也没人回，
    我很生气，
    想退款。
    `);
  const [threadId, setThreadId] = useState("graph-user-1");

  return (
    <DemoLayout
      title="LangGraph 工作流"
      left={
        <>
          <FieldLabel>输入</FieldLabel>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} />
          <FieldLabel>Thread ID</FieldLabel>
          <input value={threadId} onChange={(event) => setThreadId(event.target.value)} />
          <div className="button-row">
            <ActionButton onClick={() => run(() => postJson("/api/lg/workflow/router", { input }))}>
              <GitBranch size={16} />
              条件路由
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => run(() => postJson("/api/lg/workflow/summarize", { input }))}>
              <Workflow size={16} />
              线性工作流
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() =>
                run(() =>
                  postJson("/api/lg/chat", {
                    threadId,
                    input,
                  }),
                )
              }
            >
              <MessageSquareText size={16} />
              记忆聊天
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => run(() => getJson(`/api/lg/state/${threadId}`))}>
              <Database size={16} />
              查看记忆
            </ActionButton>
          </div>
        </>
      }
      right={<ResultPanel state={state} />}
    />
  );
}

function ApprovalDemo() {
  const { state, run } = useApiState();
  const [threadId, setThreadId] = useState("approval-1");
  const [request, setRequest] = useState("给用户发送 100 元优惠券");
  const [editedDraft, setEditedDraft] = useState("给用户发送 50 元优惠券，并备注客服补偿");

  return (
    <DemoLayout
      title="人工审批"
      left={
        <>
          <FieldLabel>Thread ID</FieldLabel>
          <input value={threadId} onChange={(event) => setThreadId(event.target.value)} />
          <FieldLabel>待审批请求</FieldLabel>
          <textarea value={request} onChange={(event) => setRequest(event.target.value)} />
          <FieldLabel>人工修改内容</FieldLabel>
          <textarea value={editedDraft} onChange={(event) => setEditedDraft(event.target.value)} />
          <div className="button-row">
            <ActionButton
              onClick={() =>
                run(() =>
                  postJson("/api/lg/approval/start", {
                    threadId,
                    request,
                  }),
                )
              }
            >
              <Play size={16} />
              启动审批
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() =>
                run(() =>
                  postJson("/api/lg/approval/resume", {
                    threadId,
                    approved: true,
                    editedDraft,
                  }),
                )
              }
            >
              <CheckCircle2 size={16} />
              批准并继续
            </ActionButton>
            <ActionButton
              variant="danger"
              onClick={() =>
                run(() =>
                  postJson("/api/lg/approval/resume", {
                    threadId,
                    approved: false,
                  }),
                )
              }
            >
              <XCircle size={16} />
              拒绝
            </ActionButton>
          </div>
        </>
      }
      right={<ResultPanel state={state} />}
    />
  );
}

function DemoLayout({
  title,
  left,
  right,
}: {
  title: string;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="demo-layout">
      <section className="control-panel">
        <div className="panel-heading">
          <h2>{title}</h2>
        </div>
        {left}
      </section>
      {right}
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const ActiveDemo = useMemo(() => {
    const map: Record<TabId, () => React.ReactElement> = {
      chat: ChatDemo,
      stream: StreamDemo,
      tools: ToolsDemo,
      rag: RagDemo,
      graph: GraphDemo,
      approval: ApprovalDemo,
    };

    return map[activeTab];
  }, [activeTab]);

  return (
    <main className="app-shell">
      <nav className="tabs" aria-label="Demo tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={tab.id === activeTab ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <ActiveDemo />
    </main>
  );
}
