// Panel templates in JSX. Each component renders exactly its file in templates/, including the
// data-template, data-slot, data-slot-attr, data-slot-repeat, and data-slot-children attributes,
// so the rendered page passes the same fidelity check as vanilla. Change only props.

export const Icon = ({ name, className = "pn-icon" }) => (
  <svg className={className} aria-hidden="true">
    <use href={`#pn-icon-${name}`} />
  </svg>
);

export function Layout({ nav, header, screen, savebar, dialogs, toasts }) {
  return (
    <div className="pn pn-layout" data-template="layout">
      <a className="pn-skip" href="#pn-main">Skip to content</a>
      <div className="pn-layout-nav" data-slot-children="nav">{nav}</div>
      <div className="pn-layout-main">
        <div className="pn-layout-slot" data-slot-children="header">{header}</div>
        <main className="pn-layout-body" id="pn-main" tabIndex={-1} data-slot-children="screen">{screen}</main>
        <div className="pn-layout-slot" data-slot-children="savebar">{savebar}</div>
      </div>
      <div className="pn-layout-slot" data-slot-children="dialogs">{dialogs}</div>
      <div className="pn-toasts" aria-live="polite" data-slot-children="toasts">{toasts}</div>
    </div>
  );
}

// entries: [{ text, href, current }]
export function Nav({ brand, entries, account }) {
  return (
    <nav className="pn-nav" aria-label="Panel" data-template="nav">
      <p className="pn-nav-brand" data-slot="brand">{brand}</p>
      <ul className="pn-nav-list" data-slot-repeat="entry">
        {entries.map((e) => (
          <li key={e.href}>
            <a className="pn-nav-link" href={e.href} aria-current={e.current ? "page" : "false"} data-slot-attr="href:href aria-current:current" data-slot="text">{e.text}</a>
          </li>
        ))}
      </ul>
      <div className="pn-nav-account-slot" data-slot-children="account">{account}</div>
    </nav>
  );
}

export function Account({ user, onLogout }) {
  return (
    <div className="pn-nav-account" data-template="account">
      <span className="pn-nav-user" data-slot="user">{user}</span>
      <button className="pn-button" data-variant="quiet" data-size="sm" type="button" data-action="logout" onClick={onLogout}>Log out</button>
    </div>
  );
}

// crumbs: [{ text, href }]; the last is current.
export function Header({ crumbs }) {
  return (
    <header className="pn-topbar" data-template="header">
      <nav aria-label="Breadcrumb">
        <ol className="pn-breadcrumb" data-slot-repeat="crumb">
          {crumbs.map((c, i) => (
            <li key={`${i}-${c.href}`}>
              <a href={c.href} aria-current={i === crumbs.length - 1 ? "page" : "false"} data-slot-attr="href:href aria-current:current" data-slot="text">{c.text}</a>
            </li>
          ))}
        </ol>
      </nav>
    </header>
  );
}

export function Savebar({ state, message, busy, onSave, onRevert }) {
  const idle = state === "clean" || state === "saving";
  return (
    <div className="pn-savebar" data-state={state} data-slot-attr="data-state:save-state" data-template="savebar" aria-busy={busy ? "true" : "false"}>
      <p className="pn-savebar-message" role="status" data-slot="message">{message}</p>
      <div className="pn-savebar-actions">
        <span className="pn-spinner" aria-hidden="true"></span>
        <button className="pn-button" data-variant="quiet" type="button" data-action="revert" disabled={idle} onClick={onRevert}>Revert</button>
        <button className="pn-button" data-variant="primary" type="button" data-action="save" disabled={idle} onClick={onSave}>Save</button>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="pn-region-loading" role="status">
      <span className="pn-spinner" aria-hidden="true"></span>
      <span data-slot="loading-text">Loading…</span>
    </div>
  );
}

// rows: [{ title, subtitle, meta, href }]
function Rows({ name, rows }) {
  return (
    <ul className="pn-list" data-slot-repeat={name}>
      {rows.map((r) => (
        <li className="pn-list-item" key={r.href}>
          <a className="pn-list-row" href={r.href} data-slot-attr="href:href">
            <span className="pn-list-text">
              <span className="pn-list-title" data-slot="title">{r.title}</span>
              <span className="pn-list-subtitle" data-slot="subtitle">{r.subtitle}</span>
            </span>
            <span className="pn-list-meta" data-slot="meta">{r.meta}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Home({ state, title, contentHeading, recentHeading, entries, recent, error }) {
  return (
    <section className="pn-screen" data-state={state} data-slot-attr="data-state:state" aria-labelledby="pn-screen-title" data-template="screen-home">
      <header className="pn-screen-header">
        <h1 className="pn-screen-title" id="pn-screen-title" data-slot="title">{title}</h1>
      </header>
      <Loading />
      <div className="pn-region-ready">
        <div className="pn-home">
          <section aria-labelledby="pn-home-content">
            <h2 className="pn-section-title" id="pn-home-content" data-slot="content-heading">{contentHeading}</h2>
            <Rows name="entry" rows={entries} />
          </section>
          <section aria-labelledby="pn-home-recent">
            <h2 className="pn-section-title" id="pn-home-recent" data-slot="recent-heading">{recentHeading}</h2>
            <Rows name="recent" rows={recent} />
          </section>
        </div>
      </div>
      <div className="pn-region-empty" data-slot-children="empty"></div>
      <div className="pn-region-error" data-slot-children="error">{error}</div>
    </section>
  );
}

// rows: [{ title, subtitle, status, tone, href }]; sorts: [{ value, text }]
export function Collection({ state, typeId, title, createLabel, onCreate, search, onSearch, searchLabel, searchPlaceholder, searchRef, sort, onSort, sortLabel, sorts, rows, empty, error }) {
  return (
    <section className="pn-screen" data-state={state} data-type={typeId} data-slot-attr="data-state:state data-type:type-id" aria-labelledby="pn-screen-title" data-template="screen-collection">
      <header className="pn-screen-header">
        <h1 className="pn-screen-title" id="pn-screen-title" data-slot="title">{title}</h1>
        <div className="pn-screen-actions">
          <button className="pn-button" data-variant="primary" type="button" data-action="create" onClick={onCreate}>
            <Icon name="plus" />
            <span data-slot="create-label">{createLabel}</span>
          </button>
        </div>
      </header>
      <Loading />
      <div className="pn-region-ready">
        <div className="pn-collection-tools" role="search">
          <label className="pn-visually-hidden" htmlFor="pn-search" data-slot="search-label">{searchLabel}</label>
          <input className="pn-input" type="search" id="pn-search" name="q" placeholder={searchPlaceholder} data-slot-attr="placeholder:search-placeholder" ref={searchRef} value={search} onChange={(e) => onSearch(e.target.value)} />
          <label className="pn-visually-hidden" htmlFor="pn-sort" data-slot="sort-label">{sortLabel}</label>
          <select className="pn-select" id="pn-sort" name="sort" data-slot-repeat="sort-option" value={sort} onChange={(e) => onSort(e.target.value)}>
            {sorts.map((s) => (
              <option key={s.value} value={s.value} data-slot-attr="value:value" data-slot="text">{s.text}</option>
            ))}
          </select>
        </div>
        <ul className="pn-list" data-slot-repeat="row">
          {rows.map((r) => (
            <li className="pn-list-item" key={r.href}>
              <a className="pn-list-row" href={r.href} data-slot-attr="href:href">
                <span className="pn-list-text">
                  <span className="pn-list-title" data-slot="title">{r.title}</span>
                  <span className="pn-list-subtitle" data-slot="subtitle">{r.subtitle}</span>
                </span>
                <span className="pn-status" data-tone={r.tone} data-slot-attr="data-tone:tone" data-slot="status">{r.status}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="pn-region-empty" data-slot-children="empty">{empty}</div>
      <div className="pn-region-error" data-slot-children="error">{error}</div>
    </section>
  );
}

export function Item({ state, typeId, title, status, tone, hasStatus, onStatus, statusRef, fields, created, updated, onDelete, deleteRef, error }) {
  return (
    <section className="pn-screen" data-state={state} data-type={typeId} data-slot-attr="data-state:state data-type:type-id" aria-labelledby="pn-screen-title" data-template="screen-item">
      <header className="pn-screen-header">
        <h1 className="pn-screen-title" id="pn-screen-title" data-slot="title">{title}</h1>
        <div className="pn-screen-actions">
          <button className="pn-status" type="button" data-tone={tone} data-action="status" data-slot-attr="data-tone:tone" hidden={!hasStatus} onClick={onStatus} ref={statusRef}>
            <span className="pn-visually-hidden">Status:</span> <span className="pn-status-text" data-slot="status">{status}</span>
          </button>
        </div>
      </header>
      <Loading />
      <div className="pn-region-ready">
        <form className="pn-item" data-kind="collection" noValidate onSubmit={(e) => e.preventDefault()}>
          <div className="pn-grid" data-slot-children="fields">{fields}</div>
          <aside className="pn-item-sidebar" aria-label="Details">
            <dl className="pn-meta">
              <dt>Created</dt>
              <dd data-slot="created">{created}</dd>
              <dt>Updated</dt>
              <dd data-slot="updated">{updated}</dd>
            </dl>
            <button className="pn-button" data-variant="negative" type="button" data-action="delete" onClick={onDelete} ref={deleteRef}>
              <Icon name="trash" />
              Delete
            </button>
          </aside>
        </form>
      </div>
      <div className="pn-region-empty" data-slot-children="empty"></div>
      <div className="pn-region-error" data-slot-children="error">{error}</div>
    </section>
  );
}

export function Singleton({ state, singletonId, title, fields, error }) {
  return (
    <section className="pn-screen" data-state={state} data-singleton={singletonId} data-slot-attr="data-state:state data-singleton:singleton-id" aria-labelledby="pn-screen-title" data-template="screen-singleton">
      <header className="pn-screen-header">
        <h1 className="pn-screen-title" id="pn-screen-title" data-slot="title">{title}</h1>
      </header>
      <Loading />
      <div className="pn-region-ready">
        <form className="pn-item" data-kind="singleton" noValidate onSubmit={(e) => e.preventDefault()}>
          <div className="pn-grid" data-slot-children="fields">{fields}</div>
        </form>
      </div>
      <div className="pn-region-error" data-slot-children="error">{error}</div>
    </section>
  );
}

export function CreateDialog({ dialogRef, title, fields, onCreate, onKeyDown }) {
  return (
    <dialog className="pn-dialog" aria-labelledby="pn-create-title" data-template="screen-create" ref={dialogRef} onKeyDown={onKeyDown}>
      <form method="dialog" noValidate>
        <div className="pn-dialog-body">
          <h2 className="pn-dialog-title" id="pn-create-title" data-slot="title">{title}</h2>
          <div className="pn-grid" data-slot-children="fields">{fields}</div>
        </div>
        <div className="pn-dialog-footer">
          <button className="pn-button" value="cancel" data-action="cancel">Cancel</button>
          <button className="pn-button" data-variant="primary" value="create" data-action="create" onClick={onCreate}>Create</button>
        </div>
      </form>
    </dialog>
  );
}

export function Dialog({ dialogRef, title, text, confirmLabel, variant }) {
  return (
    <dialog className="pn-dialog" aria-labelledby="pn-dialog-title" aria-describedby="pn-dialog-text" data-template="screen-dialog" ref={dialogRef}>
      <form method="dialog">
        <div className="pn-dialog-body">
          <h2 className="pn-dialog-title" id="pn-dialog-title" data-slot="title">{title}</h2>
          <p className="pn-dialog-text" id="pn-dialog-text" data-slot="text">{text}</p>
        </div>
        <div className="pn-dialog-footer">
          <button className="pn-button" value="cancel" data-action="cancel">Cancel</button>
          <button className="pn-button" data-variant={variant} value="confirm" data-action="confirm" data-slot-attr="data-variant:variant" data-slot="confirm-label">{confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}

export function SlideOver({ dialogRef, title, body }) {
  return (
    <dialog className="pn-drawer" aria-labelledby="pn-drawer-title" data-template="screen-slide-over" ref={dialogRef}>
      <form className="pn-drawer-form" method="dialog" noValidate>
        <div className="pn-drawer-header">
          <h2 className="pn-drawer-title" id="pn-drawer-title" data-slot="title">{title}</h2>
          <button className="pn-button" data-variant="quiet" data-icon-only="" data-size="sm" value="close" aria-label="Close" data-action="close">
            <Icon name="close" />
          </button>
        </div>
        <div className="pn-drawer-body" data-slot-children="body">{body}</div>
        <div className="pn-drawer-footer">
          <button className="pn-button" value="cancel" data-action="cancel">Cancel</button>
          <button className="pn-button" data-variant="primary" value="done" data-action="done">Done</button>
        </div>
      </form>
    </dialog>
  );
}

export function Login({ title, text, methods, error }) {
  return (
    <main className="pn pn-login" data-template="screen-login">
      <div className="pn-login-card">
        <h1 className="pn-login-title" data-slot="title">{title}</h1>
        <p className="pn-login-text" data-slot="text">{text}</p>
        <div className="pn-login-methods" data-slot-children="methods">{methods}</div>
        <p className="pn-error" role="alert" data-slot="error">{error}</p>
      </div>
    </main>
  );
}

export function Empty({ icon, title, text, actions }) {
  return (
    <div className="pn-empty" data-template="empty">
      <svg className="pn-icon pn-empty-icon" aria-hidden="true">
        <use href={icon} data-slot-attr="href:icon" />
      </svg>
      <p className="pn-empty-title" data-slot="title">{title}</p>
      <p className="pn-empty-text" data-slot="text">{text}</p>
      <div className="pn-empty-actions" data-slot-children="actions">{actions}</div>
    </div>
  );
}

export function ErrorState({ title, text, actions }) {
  return (
    <div className="pn-empty" data-tone="negative" role="alert" data-template="error">
      <Icon name="alert" className="pn-icon pn-empty-icon" />
      <p className="pn-empty-title" data-slot="title">{title}</p>
      <p className="pn-empty-text" data-slot="text">{text}</p>
      <div className="pn-empty-actions" data-slot-children="actions">{actions}</div>
    </div>
  );
}

// A design-system button, for slot-children containers.
export function Button({ variant, action, onClick, children }) {
  return (
    <button className="pn-button" type="button" data-variant={variant} data-action={action} onClick={onClick}>
      {children}
    </button>
  );
}

export function Toast({ text, tone, onDismiss }) {
  return (
    <div className="pn-toast" role={tone === "negative" ? "alert" : "status"} data-tone={tone === "info" ? undefined : tone}>
      <p className="pn-toast-text">{text}</p>
      <button className="pn-button" type="button" data-variant="quiet" data-icon-only="" data-size="sm" aria-label="Dismiss" onClick={onDismiss}>
        <Icon name="close" />
      </button>
    </div>
  );
}
