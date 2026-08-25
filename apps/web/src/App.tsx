import { foundationIdentity } from '@icarus-graph-explorer/core';

import './App.css';

export function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main className="foundation-shell" id="main-content">
        <section className="foundation-card" aria-labelledby="product-title">
          <p className="eyebrow">Repository foundation</p>
          <h1 id="product-title" translate="no">
            {foundationIdentity.productName}
          </h1>
          <p className="description">{foundationIdentity.description}</p>
          <p className="status" role="status">
            <span className="status-dot" aria-hidden="true" />
            {foundationIdentity.status}
          </p>
          <p className="scope-note">
            Parser, vault access, and graph rendering are deliberately deferred.
          </p>
        </section>
      </main>
    </>
  );
}
