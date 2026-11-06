import ReactMarkdown from "react-markdown"

/** Renders Markdown (the coach's replies, the privacy policy), styled with brand tokens. No raw HTML. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        h2: (props) => <h2 className="mt-8 mb-3 text-[17px] font-semibold tracking-[-0.01em] text-foreground first:mt-0" {...props} />,
        p: (props) => <p className="mb-3 leading-7 last:mb-0" {...props} />,
        ul: (props) => <ul className="mb-3 list-disc space-y-1.5 ps-5 last:mb-0 marker:text-hint" {...props} />,
        ol: (props) => <ol className="mb-3 list-decimal space-y-1.5 ps-5 last:mb-0 marker:text-hint" {...props} />,
        li: (props) => <li className="leading-7 ps-1" {...props} />,
        strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
        code: (props) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]" {...props} />,
        a: (props) => <a className="underline underline-offset-4" target="_blank" rel="noreferrer" {...props} />,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
