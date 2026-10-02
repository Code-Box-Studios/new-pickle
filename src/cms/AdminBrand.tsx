export function AdminIcon() {
  return (
    <span className="cms-brand-icon" aria-hidden>
      P
    </span>
  );
}
export function AdminBrand() {
  return (
    <div className="cms-brand">
      <AdminIcon />
      <span>
        Pikol <small>Content studio</small>
      </span>
    </div>
  );
}
export function EditorIntro() {
  return (
    <section className="cms-intro">
      <p className="cms-eyebrow">Make it yours</p>
      <h1>Your website, your words.</h1>
      <p>Edit a page, save a draft, and publish when it&apos;s ready.</p>
      <a href="/" target="_blank" rel="noreferrer">
        Open website ↗
      </a>
    </section>
  );
}
export function EditorLogout() {
  return (
    <form action="/api/auth/logout" method="post">
      <button className="cms-logout" type="submit">
        Sign out
      </button>
    </form>
  );
}
