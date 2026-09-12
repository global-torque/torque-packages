export const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export const stripMarkdown = (markdown: string): string => {
  // Replace bold text with plain text
  markdown = markdown.replace(/\*\*(.+?)\*\*/g, '');
  markdown = markdown.replace(/__(.+?)__/g, '');

  // Replace italicized text with plain text
  markdown = markdown.replace(/_(.+?)_/g, '');
  markdown = markdown.replace(/\*(.+?)\*/g, '');

  // Replace strikethrough text with plain text
  markdown = markdown.replace(/~~(.+?)~~/g, '');

  // Replace inline code blocks with plain text
  markdown = markdown.replace(/`(.+?)`/g, '');

  // Replace code blocks with plain text (multiline)
  markdown = markdown.replace(/```[\s\S]*?```/g, '');

  // Keep the text inside links but remove the URL
  markdown = markdown.replace(/\[(.+?)\]\((.+?)\)/g, '$1');

  // Remove images
  markdown = markdown.replace(/!\[(.+?)\]\((.+?)\)/g, '');

  // Remove headings
  markdown = markdown.replace(/^#+\s+(.+?)\s*$/gm, '');
  markdown = markdown.replace(/^\s*=+\s*$/gm, '');
  markdown = markdown.replace(/^\s*-+\s*$/gm, '');

  // Remove blockquotes
  markdown = markdown.replace(/^\s*>\s+(.+?)\s*$/gm, '');

  // Remove lists
  markdown = markdown.replace(/^\s*[*+-]\s+(.+?)\s*$/gm, '');
  markdown = markdown.replace(/^\s*\d+\.\s+(.+?)\s*$/gm, '');

  // Remove horizontal lines
  markdown = markdown.replace(/^\s*[-*_]{3,}\s*$/gm, '');

  return markdown;
};

export function stripHtml(html: string) {
  return html.replace(/(<([^>]+)>)/gi, '');
}

export function stripHtmlAndMarkdown(html: string) {
  return stripMarkdown(stripHtml(html));
}
