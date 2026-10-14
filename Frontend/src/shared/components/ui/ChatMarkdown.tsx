import { Fragment, useMemo, type ReactElement } from 'react';
import {
  parseChatMarkdown,
  type ChatBlock,
  type ChatInline,
  type ChatLine,
} from '../../utils/chatMarkdown';

function InlineText({ inline }: { inline: ChatInline }): ReactElement {
  if (inline.kind === 'strong') return <strong className="font-bold">{inline.text}</strong>;
  if (inline.kind === 'em') return <em>{inline.text}</em>;
  return <>{inline.text}</>;
}

function LineText({ line }: { line: ChatLine }): ReactElement {
  return (
    <>
      {line.inlines.map((inline) => (
        <InlineText key={inline.offset} inline={inline} />
      ))}
    </>
  );
}

function Block({ block }: { block: ChatBlock }): ReactElement {
  if (block.kind === 'paragraph') {
    // A bare `p` takes the page default (Times New Roman, a bottom margin), so it names the body
    // role the chat bubbles use.
    return (
      <p className="m-0 type-body">
        {block.lines.map((line, index) => (
          <Fragment key={line.lineNumber}>
            {index > 0 && <br />}
            <LineText line={line} />
          </Fragment>
        ))}
      </p>
    );
  }
  const items = block.items.map((item) => (
    <li key={item.lineNumber} className="pl-1">
      <LineText line={item} />
    </li>
  ));
  return block.ordered ? (
    <ol start={block.start} className="m-0 flex list-decimal flex-col gap-1 pl-5">
      {items}
    </ol>
  ) : (
    <ul className="m-0 flex list-disc flex-col gap-1 pl-5">{items}</ul>
  );
}

/**
 * An assistant reply with its light formatting shown instead of its Markdown marks. Every piece
 * is a React text node, so a reply that contains HTML shows it as text and never runs it.
 */
export function ChatMarkdown({ text }: { text: string }): ReactElement {
  const blocks = useMemo(() => parseChatMarkdown(text), [text]);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block) => (
        <Block key={firstLineOf(block)} block={block} />
      ))}
    </div>
  );
}

function firstLineOf(block: ChatBlock): number {
  const first = block.kind === 'paragraph' ? block.lines[0] : block.items[0];
  return first?.lineNumber ?? 0;
}
