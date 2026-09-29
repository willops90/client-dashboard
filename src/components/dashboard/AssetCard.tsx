"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Asset } from "@/lib/types";
import { PreviewBlocks } from "./PreviewBlocks";

/**
 * One asset with its preview. On a phone the preview expands inline; on
 * wider screens it opens in a modal dialog (Esc or Close to dismiss).
 */
export function AssetPreviewControl({ asset, showDescription = false }: { asset: Asset; showDescription?: boolean }) {
  const [inline, setInline] = useState(false);
  const [modal, setModal] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const inlineId = useId();
  const titleId = useId();

  useEffect(() => {
    if (modal) dialog.current?.showModal();
  }, [modal]);

  if (!asset.preview) return null;

  function open() {
    if (window.matchMedia("(min-width: 721px)").matches) setModal(true);
    else setInline((v) => !v);
  }

  return (
    <>
      <button type="button" className="btn secondary sm preview-btn" onClick={open} aria-expanded={inline} aria-controls={inlineId}>
        {inline ? "Hide preview" : "Preview"}
      </button>
      <div id={inlineId} className="preview-inline" hidden={!inline}>
        {inline && showDescription && asset.description && <p className="pv-text pv-desc">{asset.description}</p>}
        {inline && <PreviewBlocks blocks={asset.preview.blocks} />}
      </div>
      {modal && (
        <dialog
          ref={dialog}
          className="preview-dialog"
          aria-labelledby={titleId}
          onClose={() => setModal(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
        >
          <div className="preview-head">
            <div>
              <h3 id={titleId}>{asset.name}</h3>
              {asset.built_on && <span className="built-on">Built on {asset.built_on}</span>}
              {showDescription && asset.description && <p className="pv-text pv-desc">{asset.description}</p>}
            </div>
            <button type="button" className="btn secondary sm" onClick={() => dialog.current?.close()} autoFocus>
              Close
            </button>
          </div>
          <PreviewBlocks blocks={asset.preview.blocks} />
          {asset.built_on && <p className="hint preview-foot">The working version lives in {asset.built_on}.</p>}
        </dialog>
      )}
    </>
  );
}
