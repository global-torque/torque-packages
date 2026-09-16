/* @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { createMarkdownRenderer } from 'vitepress';
import tableWrap from '@global-torque/invest-core/markdown/tableWrap';

describe('VitePress Markdown plugin compatibility', () => {
  it('uses the public table plugin with VitePress-owned Markdown', async () => {
    const renderer = await createMarkdownRenderer(process.cwd());
    renderer.use(tableWrap);
    expect(renderer.render('| A |\n| - |\n| B |')).toContain('<div class="v-table__wrap">\n<table tabindex="0">');
  });
});
