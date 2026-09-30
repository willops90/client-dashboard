/** The Owner Optional mark: two overlapping rings (the owner and the business, separable) and the wordmark. */
export function OwnerOptionalLogo() {
  return (
    <span className="oo-logo" role="img" aria-label="Owner Optional Advisory">
      <svg className="oo-mark" viewBox="0 0 42 30" aria-hidden="true" focusable="false">
        <g fill="none" strokeWidth="1.7">
          <circle cx="15" cy="15" r="11" className="oo-ring-a" />
          <circle cx="27" cy="15" r="11" className="oo-ring-b" />
        </g>
      </svg>
      <span className="oo-text" aria-hidden="true">
        <span className="oo-name">
          Owner<i>Optional</i>
        </span>
        <span className="oo-tag">Advisory</span>
      </span>
    </span>
  );
}
