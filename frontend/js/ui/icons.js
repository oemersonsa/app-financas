export const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  wallet:
    '<path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v5h5M16 14.5h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  in: '<path d="M17 7 7 17M7 7v10h10"/>',
  out: '<path d="M7 17 17 7M7 7h10v10"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  receipt:
    '<path d="M6 3 9 5l3-2 3 2 3-2v18l-3-2-3 2-3-2-3 2V3zM9 9h6M9 13h6"/>',
  chart: '<path d="M3 3v18h18M7 16v-4M12 16V8M17 16V5"/>',
  leaf: '<path d="M20 3c0 12-3 17-10 17a7 7 0 0 1-7-7C3 6 8 3 20 3zM5 19 15 9"/>',
  edit: '<path d="m15 4 5 5M4 20l4-1L21 6a2 2 0 0 0-3-3L5 16l-1 4z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  food: '<path d="M5 3v7m3-7v7m-6-7v7a3 3 0 0 0 6 0M5 13v8M18 3c-4 0-4 10 0 10h2V3h-2zm2 10v8"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
  car: '<path d="m5 6-2 7v6h18v-6l-2-7H5zM3 13h18M6 16h.01M18 16h.01M5 19v2M19 19v2"/>',
  heart:
    '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 5 2 10 8 15 6-5 12-10 8-15z"/>',
  book: '<path d="M12 5v15M3 4c4-1 6 0 9 1 3-1 5-2 9-1v15c-4-1-6 0-9 1-3-1-5-2-9-1V4z"/>',
};

export const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.receipt}</svg>`;

export function initializeIcons() {
  document.querySelectorAll("[data-icon]").forEach((element) => {
    element.innerHTML = svg(element.dataset.icon);
  });
}
