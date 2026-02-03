import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Link,
  Image,
  Table,
  FileText,
  Wand2,
  Network,
  ChevronDown
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { memo } from 'react';

interface EditorToolbarProps {
  onInsert: (prefix: string, suffix: string) => void;
  onUpload?: (type: 'image' | 'file') => void;
  onFormat?: () => void;
}

const mermaidTemplates = {
  flowchart: {
    label: '流程图',
    template: `\`\`\`mermaid
flowchart LR
    A[开始] --> B{判断}
    B -->|条件满足| C[执行操作A]
    B -->|条件不满足| D[执行操作B]
    C --> E[结束]
    D --> E
\`\`\``,
  },
  sequence: {
    label: '时序图',
    template: `\`\`\`mermaid
sequenceDiagram
    participant 用户
    participant 系统

    用户->>系统: 发送请求
    系统-->>用户: 返回响应
\`\`\``,
  },
  class: {
    label: '类图',
    template: `\`\`\`mermaid
classDiagram
    class Animal{
        +String name
        +int age
        +eat()
    }
    class Dog{
        +bark()
    }
    Animal <|-- Dog
\`\`\``,
  },
  state: {
    label: '状态图',
    template: `\`\`\`mermaid
stateDiagram-v2
    [*] --> 待处理
    待处理 --> 进行中: 开始处理
    进行中 --> 已完成: 处理完成
    进行中 --> 已取消: 取消
    已完成 --> [*]
    已取消 --> [*]
\`\`\``,
  },
  mindmap: {
    label: '思维导图',
    template: `\`\`\`mermaid
mindmap
  root((主题))
    分支1
      子项1
      子项2
    分支2
      子项3
      子项4
\`\`\``,
  },
  gantt: {
    label: '甘特图',
    template: `\`\`\`mermaid
gantt
    title 项目计划
    dateFormat YYYY-MM-DD
    section 任务1
    任务1.1: 2024-01-01, 7d
    任务1.2: after task1.1, 5d
    section 任务2
    任务2.1: 2024-01-10, 10d
\`\`\``,
  },
  pie: {
    label: '饼图',
    template: `\`\`\`mermaid
pie title 数据分布
    "类型A": 30
    "类型B": 50
    "类型C": 20
\`\`\``,
  },
  er: {
    label: 'ER图',
    template: `\`\`\`mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string name
        string email
    }
    ORDER {
        int id
        date created
    }
\`\`\``,
  },
  journey: {
    label: '旅程图',
    template: `\`\`\`mermaid
journey
    title 用户旅程
    section 阶段1
      步骤1: 5: 用户
      步骤2: 4: 用户
    section 阶段2
      步骤3: 3: 用户
\`\`\``,
  },
  git: {
    label: 'Git图',
    template: `\`\`\`mermaid
gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
\`\`\``,
  },
};

export const EditorToolbar = memo(function EditorToolbar({ onInsert, onUpload, onFormat }: EditorToolbarProps) {
  const tools = [
    { icon: Bold, label: 'Bold', prefix: '**', suffix: '**' },
    { icon: Italic, label: 'Italic', prefix: '*', suffix: '*' },
    { icon: Heading1, label: 'H1', prefix: '# ', suffix: '' },
    { icon: Heading2, label: 'H2', prefix: '## ', suffix: '' },
    { icon: Heading3, label: 'H3', prefix: '### ', suffix: '' },
    { icon: Quote, label: 'Quote', prefix: '> ', suffix: '' },
    { icon: Code, label: 'Code', prefix: '```\n', suffix: '\n```' },
    { icon: Link, label: 'Link', prefix: '[', suffix: '](url)' },
    {
      icon: Image,
      label: 'Insert Image',
      prefix: '',
      suffix: '',
      action: () => onUpload && onUpload('image')
    },
    {
      icon: FileText,
      label: 'Insert File',
      prefix: '',
      suffix: '',
      action: () => onUpload && onUpload('file')
    },
    { icon: Table, label: 'Table', prefix: '| Header | Header |\n| --- | --- |\n| Cell | Cell |', suffix: '' },
    {
      icon: Wand2,
      label: 'Format Document',
      prefix: '',
      suffix: '',
      action: onFormat
    }
  ];

  const handleInsertMermaid = (template: string) => {
    onInsert(template, '');
  };

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex items-center gap-1 overflow-x-auto">
        {tools.map((tool, index) => (
          <button
            key={index}
            onClick={() => tool.action ? tool.action() : onInsert(tool.prefix, tool.suffix)}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title={tool.label}
          >
            <tool.icon size={16} />
          </button>
        ))}

        <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />

        {/* Mermaid Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex items-center gap-1 px-2 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-sm font-medium"
              title="插入 Mermaid 图表"
            >
              <Network size={16} />
              <ChevronDown size={12} />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[200px] z-50"
              align="start"
              sideOffset={5}
            >
              <DropdownMenu.Label className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Mermaid 图表
              </DropdownMenu.Label>

              {Object.entries(mermaidTemplates).map(([key, { label, template }]) => (
                <DropdownMenu.Item
                  key={key}
                  className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => handleInsertMermaid(template)}
                >
                  {label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
});
