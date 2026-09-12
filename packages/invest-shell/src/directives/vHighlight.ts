import type { DirectiveBinding } from 'vue';

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function clearHighlights(el: HTMLElement) {
  el.innerHTML = el.innerHTML.replace(/<\/?span[^>]*>/g, '');
}

function highlightText(el: HTMLElement, word: string) {
  if (!word) {
    clearHighlights(el);
    return;
  }

  const { innerHTML } = el;
  const regex = new RegExp(`(?!<[^>]*?)(${escapeRegExp(word)})(?![^<]*?>)`, 'gi');

  // Clear previous highlights
  const cleanHTML = innerHTML.replace(/<\/?span[^>]*>/g, '');

  const newHTML = cleanHTML.replace(regex, (match) => `<span class="highlight">${match}</span>`);
  el.innerHTML = newHTML;
}

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    highlightText(el, binding.value);
  },
  updated(el: HTMLElement, binding: DirectiveBinding) {
    highlightText(el, binding.value);
  },
};

