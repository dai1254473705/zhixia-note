import { marked } from 'marked';
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css'; 
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';

marked.use({
  breaks: true,
  gfm: true,
});

const renderer = new marked.Renderer();

// Custom Link Renderer for File Icons
// eslint-disable-next-line @typescript-eslint/no-explicit-any
renderer.link = function({ href, title, tokens }: { href: string; title?: string | null; tokens: any[] }) {
  const text = this.parser.parseInline(tokens);
  if (!href) return text;
  
  const ext = href.split('.').pop()?.toLowerCase();
  let icon = '';
  
  // Simple extension check (exclude common web protocols to avoid icon on http links unless they end in ext)
  const isWeb = href.startsWith('http') || href.startsWith('www');
  
  if (!isWeb || (isWeb && href.match(/\.(pdf|doc|docx|xls|xlsx|zip|rar|7z|txt|md)$/i))) {
    switch (ext) {
      case 'pdf': icon = '📄 '; break;
      case 'doc': 
      case 'docx': icon = '📝 '; break;
      case 'xls': 
      case 'xlsx': icon = '📊 '; break;
      case 'ppt': 
      case 'pptx': icon = '📢 '; break;
      case 'zip': 
      case 'rar': 
      case '7z': icon = '📦 '; break;
      case 'txt': 
      case 'md': icon = '📃 '; break;
      // Add more as needed
    }
  }

  // Open in new tab/window for files or external links
  const target = ' target="_blank" rel="noopener noreferrer"';
  
  return `<a href="${href}" title="${title || ''}"${target}>${icon}${text}</a>`;
};

marked.use({ renderer });

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

export const Preview = observer(({ content }: { content: string }) => {
  const { uiStore, fileStore } = useStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Custom Image Renderer to intercept and rewrite local paths
    // We do this inside useEffect/component to access fileStore context
    const customRenderer = new marked.Renderer();
    
    // Preserve existing link renderer logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customRenderer.link = renderer.link;

    // Custom Image Renderer
    customRenderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
      if (!href) return text;

      let src = href;
      let style = '';
      
      // Parse Query Params for size (e.g. ?w=100px)
      try {
        // Use a dummy base for relative URLs
        const urlObj = new URL(href, 'http://dummy');
        const width = urlObj.searchParams.get('w');
        const height = urlObj.searchParams.get('h');
        
        if (width) style += `width: ${width};`;
        if (height) style += `height: ${height};`;
        
        // Note: we keep the query params in the src because the main process ignores them for file path resolution,
        // and removing them might break some web URLs that depend on them.
        // But for local files, it shouldn't matter.
      } catch {
        // Ignore parsing errors
      }

      // If it's a relative path and not a web URL
      if (!href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('media:')) {
         if (fileStore.currentFile) {
             // Construct absolute path using a simple slash join (assuming macOS/Linux forward slashes for now)
             // or better, let the main process handle the joining if we passed just the filename.
             // But here we have relative path like "files/image.png".
             
             // We need the directory of the current file.
             // /Users/user/project/doc.md -> /Users/user/project
             const currentFilePath = fileStore.currentFile.path;
             const lastSlashIndex = currentFilePath.lastIndexOf('/');
             if (lastSlashIndex !== -1) {
                 const currentDir = currentFilePath.substring(0, lastSlashIndex);
                 // Construct media:// URL
                 // Note: we need to handle if href starts with ./ or ../
                 // For now, assuming simple "files/..."
                 const absolutePath = `${currentDir}/${href}`;
                 // Use a dummy host 'local' to ensure the path is treated as an absolute pathname
                 // This prevents issues where the first directory component is interpreted as the host
                 // e.g. media:///Users/... vs media://users/...
                 src = `media://local${absolutePath}`;
             }
         }
      }

      return `<img src="${src}" alt="${text}" title="${title || ''}" style="${style}" />`;
    };

    marked.use({ renderer: customRenderer });

    if (ref.current) {
      // 1. Markdown Parsing
      const html = marked.parse(content || '', { async: false }) as string;
      ref.current.innerHTML = html;
      
      // 2. Syntax Highlighting
      ref.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });

      // 3. Mermaid Rendering
      const mermaidBlocks = ref.current.querySelectorAll('code.language-mermaid');
      mermaidBlocks.forEach((block, index) => {
        const pre = block.parentElement;
        if (pre) {
          const div = document.createElement('div');
          div.className = 'mermaid';
          div.textContent = block.textContent || '';
          div.id = `mermaid-${index}`;
          pre.replaceWith(div);
        }
      });

      if (ref.current.querySelector('.mermaid')) {
        mermaid.run({
            nodes: ref.current.querySelectorAll('.mermaid')
        });
      }
    }
  }, [content]);

  const getThemeClass = () => {
    if (!uiStore.markdownTheme || uiStore.markdownTheme === 'default') {
      return 'prose dark:prose-invert max-w-none p-6 md:p-10 lg:p-12';
    }
    return `markdown-theme-container md-style-${uiStore.markdownTheme} p-6 md:p-10 lg:p-12`;
  };

  const themeStyles = {
    '--md-primary-color': uiStore.themeColor,
    '--md-primary-bg-color': `${uiStore.themeColor}15`, // 15 is hex alpha ~8%
  } as React.CSSProperties;

  return (
    <div 
      className={getThemeClass()} 
      style={themeStyles}
      ref={ref} 
    />
  );
});
