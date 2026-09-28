import type { ComponentChildren } from 'preact';
import { sendMessage } from '../shared/messages';

export type StatusMessage = { kind: 'ok' | 'error' | 'info'; text: string } | null;

export function Section(props: { title: string; hint?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="section">
      <h2>{props.title}</h2>
      {props.hint && <p class="hint">{props.hint}</p>}
      {props.children}
    </section>
  );
}

export function Toggle(props: { checked: boolean; label: ComponentChildren; onChange: (checked: boolean) => void }) {
  return (
    <label class="toggle">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.currentTarget.checked)} />
      <span>{props.label}</span>
    </label>
  );
}

export function Stat(props: { value: string | number; label: string }) {
  return (
    <div class="stat">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  );
}

export function Notice(props: { kind: 'error' | 'ok' | 'info'; children: ComponentChildren }) {
  return <p class={`notice ${props.kind}`}>{props.children}</p>;
}

/** A button that opens a file picker. The input is reset after each pick, so picking the same file again works. */
export function FileButton(props: {
  label: string;
  accept: string;
  class?: string;
  onFile: (file: File) => void | Promise<void>;
}) {
  return (
    <label class={`button ${props.class ?? ''}`}>
      {props.label}
      <input
        type="file"
        accept={props.accept}
        hidden
        onChange={(e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = '';
          if (file) void props.onFile(file);
        }}
      />
    </label>
  );
}

/** Syncs export links through the service worker and reports progress/outcome via `onStatus`. */
export function SyncButton(props: {
  sourceIds?: string[];
  label?: string;
  class?: string;
  onStatus: (status: StatusMessage) => void;
}) {
  return (
    <button
      class={props.class}
      onClick={async () => {
        props.onStatus({ kind: 'info', text: 'Syncing…' });
        const r = await sendMessage({ type: 'syncLinks', sourceIds: props.sourceIds });
        props.onStatus(r.ok ? { kind: 'ok', text: 'Synced.' } : { kind: 'error', text: r.error ?? 'Sync failed' });
      }}
    >
      {props.label ?? 'Sync now'}
    </button>
  );
}
