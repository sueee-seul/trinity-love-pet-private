import '@testing-library/jest-dom';

// jsdom doesn't implement scrollIntoView; components that call it on mount/update
// (e.g. auto-scrolling a message stream) would otherwise throw in every test that renders them.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

// jsdom has <dialog> but not showModal() or close(). The shared date picker opens in a native
// dialog, so without these every test that opens it would throw. This only toggles `open` and
// fires `close` the way a browser does; it does not model the top layer or focus trapping.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
