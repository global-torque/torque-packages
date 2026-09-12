import type MarkdownIt from 'markdown-it';

/**
 * Plugin to wrap tables in a div with overflow scrolling
 * This allows tables to be horizontally scrollable on smaller screens
 * Matches the VTable component's wrapper structure
 */
export const tableWrap = (md: MarkdownIt): void => {
  // Store the original table renderers if they exist
  const defaultTableOpen = md.renderer.rules.table_open || ((tokens, idx, options, env, self) => {
    return self.renderToken(tokens, idx, options);
  });
  const defaultTableClose = md.renderer.rules.table_close || ((tokens, idx, options, env, self) => {
    return self.renderToken(tokens, idx, options);
  });

  // Override table_open to add opening wrapper div
  md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
    return '<div class="v-table__wrap">\n' + defaultTableOpen(tokens, idx, options, env, self);
  };

  // Override table_close to add closing wrapper div
  md.renderer.rules.table_close = (tokens, idx, options, env, self) => {
    return defaultTableClose(tokens, idx, options, env, self) + '\n</div>';
  };
};

export default tableWrap;

