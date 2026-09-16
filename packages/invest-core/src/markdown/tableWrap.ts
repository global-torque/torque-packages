// The plugin forwards renderer arguments unchanged. Infer their types from the
// host so Markdown 14 and 15 can each retain their own token/options contracts.
interface TokenRenderer<Tokens, Options> {
  renderToken(tokens: Tokens, idx: number, options: Options): string;
}
type TableRule<Tokens, Options, Env, Renderer> = (
  tokens: Tokens, idx: number, options: Options, env: Env, self: Renderer,
) => string;

/**
 * Plugin to wrap tables in a div with overflow scrolling
 * This allows tables to be horizontally scrollable on smaller screens
 * Matches the VTable component's wrapper structure
 */
export const tableWrap = <Tokens, Options, Env, Renderer extends TokenRenderer<Tokens, Options>>(
  md: { renderer: { rules: Record<string, TableRule<Tokens, Options, Env, Renderer> | undefined> } },
): void => {
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
